use axum::{
    body::Bytes,
    extract::State,
    http::{header, HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use image_compressor_rust_service::compress_image_bytes;
use log::{error, info, warn};
use serde_json::json;
use std::net::SocketAddr;
use std::sync::{
    atomic::{AtomicUsize, Ordering},
    Arc,
};
use std::time::Instant;
use tower_http::trace::TraceLayer;

// Define a shared state for our application
#[derive(Clone)]
struct AppState {
    request_counter: Arc<AtomicUsize>,
    processed_bytes: Arc<AtomicUsize>,
}

#[tokio::main]
async fn main() {
    // Initialize tracing (structured logging)
    tracing_subscriber::fmt()
        .with_max_level(tracing::Level::INFO)
        .with_target(false)
        .json()
        .init();

    info!("Initializing server...");

    let state = AppState {
        request_counter: Arc::new(AtomicUsize::new(0)),
        processed_bytes: Arc::new(AtomicUsize::new(0)),
    };

    // Build our application router
    let app = Router::new()
        .route("/compress", post(compress_handler))
        .route("/health", get(health_handler))
        .route("/metrics", get(metrics_handler))
        .with_state(state)
        .layer(TraceLayer::new_for_http());

    // Run the server
    let addr = SocketAddr::from(([0, 0, 0, 0], 8000));
    info!("Server listening on {}", addr);
    axum::Server::bind(&addr)
        .serve(app.into_make_service())
        .await
        .unwrap();
}

/// Handles image compression requests.
///
/// It expects the image data in the request body and an optional
/// `X-Compression-Quality` header to specify the quality (1-100).
async fn compress_handler(
    State(state): State<AppState>,
    headers: HeaderMap,
    body: Bytes,
) -> Response {
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

            // Update metrics
            state.request_counter.fetch_add(1, Ordering::SeqCst);
            state
                .processed_bytes
                .fetch_add(body.len(), Ordering::SeqCst);

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

/// Provides simple metrics for the service.
async fn metrics_handler(State(state): State<AppState>) -> impl IntoResponse {
    info!("Metrics requested.");
    (
        StatusCode::OK,
        Json(json!({
            "requests_processed": state.request_counter.load(Ordering::SeqCst),
            "bytes_processed": state.processed_bytes.load(Ordering::SeqCst),
        })),
    )
}
