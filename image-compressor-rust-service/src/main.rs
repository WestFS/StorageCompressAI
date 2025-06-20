use axum::{
    body::Bytes,
    http::{header, HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
    extract::DefaultBodyLimit,
};
use image_compressor_rust_service::compress_image_bytes;
use serde_json::json;
use std::net::SocketAddr;
use std::time::Instant;
use tower_http::trace::TraceLayer;
use tracing::{error, info, warn};
use metrics_exporter_prometheus::PrometheusHandle;
use std::sync::Arc;

#[tokio::main]
async fn main() {
    // Initialize tracing (structured logging)
    tracing_subscriber::fmt()
        .with_max_level(tracing::Level::INFO)
        .with_target(false)
        .json()
        .init();

    info!("Initializing server...");

    let builder = metrics_exporter_prometheus::PrometheusBuilder::new();
    let handle = builder.install_recorder().unwrap();
    let handle = Arc::new(handle);

    // Build our application router
    let app = Router::new()
        .route("/compress", post(compress_handler))
        .route("/health", get(health_handler))
        .route("/metrics", get({
            let handle = handle.clone();
            move || metrics_handler(handle.clone())
        }))
        .layer(TraceLayer::new_for_http())
        .layer(DefaultBodyLimit::max(10 * 1024 * 1024)); // 10 MB

    // Run the server
    let addr = SocketAddr::from(([0, 0, 0, 0], 8000));
    info!("Server listening on {}", addr);
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

/// Handles image compression requests.
///
/// It expects the image data in the request body and an optional
/// `X-Compression-Quality` header to specify the quality (1-100).
async fn compress_handler(headers: HeaderMap, body: Bytes) -> Response {
    let start_time = Instant::now();
    info!(
        "Received compression request. Body size: {} bytes",
        body.len()
    );

    if body.is_empty() {
        warn!("Request body is empty.");
        return (StatusCode::BAD_REQUEST, "Request body cannot be empty.").into_response();
    }

    // Extract quality from header, with a default of 80
    let quality = headers
        .get("X-Compression-Quality")
        .and_then(|v| v.to_str().ok())
        .and_then(|s| s.parse::<u8>().ok())
        .filter(|&q| (1..=100).contains(&q))
        .unwrap_or(80);

    info!("Using compression quality: {}", quality);

    match compress_image_bytes(&body, quality) {
        Ok(compressed_data) => {
            let duration = start_time.elapsed();
            info!(
                "Compression successful in {:.2?}. Original size: {}, Compressed size: {}",
                duration,
                body.len(),
                compressed_data.len()
            );

            (
                StatusCode::OK,
                [(header::CONTENT_TYPE, "image/jpeg")],
                compressed_data,
            )
                .into_response()
        }
        Err(e) => {
            error!("Image compression failed: {:?}", e);
            (
                StatusCode::UNPROCESSABLE_ENTITY,
                format!("Failed to compress image: {}", e),
            )
                .into_response()
        }
    }
}

/// Provides a simple health check endpoint.
async fn health_handler() -> impl IntoResponse {
    info!("Health check requested.");
    (StatusCode::OK, Json(json!({ "status": "ok" })))
}

async fn metrics_handler(handle: Arc<PrometheusHandle>) -> impl IntoResponse {
    let body = handle.render();
    (StatusCode::OK, [(header::CONTENT_TYPE, "text/plain")], body)
}
