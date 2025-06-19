# The Image Compression Service: A Detailed Technical Explainer

---

## Table of Contents
1.  [**High-Level Architecture**](#1-high-level-architecture): A diagram and overview of the microservice approach.
2.  [**Service 1: The Rust Compression Engine**](#2-service-1-the-rust-compression-engine): Deep dive into the `image-compressor-rust-service`.
    -   [Core Logic (`lib.rs`)](#core-logic-librs)
    -   [The Axum Web Server (`main.rs`)](#the-axum-web-server-mainrs)
    -   [Key Dependencies](#key-dependencies-rust)
3.  [**Service 2: The Fastify API Gateway**](#3-service-2-the-fastify-api-gateway): Deep dive into the `image-compressor-fastify-api`.
    -   [Application Structure](#application-structure-fastify)
    -   [Request Lifecycle](#request-lifecycle)
    -   [Key Dependencies](#key-dependencies-fastify)
4.  [**Observability: Health & Metrics**](#4-observability-health--metrics): How monitoring is implemented.
5.  [**Containerization & Orchestration**](#5-containerization--orchestration): How Docker and Docker Compose are used.
6.  [**Error Handling Strategy**](#6-error-handling-strategy): How errors are managed across services.
7.  [**Security Measures**](#7-security-measures): API key and rate limiting.

---

## 1. High-Level Architecture

This project uses a **microservice architecture** to separate concerns, allowing each component to be optimized and scaled independently.

-   The **Rust Compression Engine** is a specialized, high-performance service responsible only for CPU-intensive image compression.
-   The **Fastify API Gateway** is the public-facing entry point, handling all I/O-bound tasks like client requests, authentication, and communication with cloud storage.

**Architectural Diagram:**
```
+------------------+      +--------------------------+      +-------------------------------+
|                  |      |                          |      |                               |
|   End User /     |----->|  Fastify API Gateway     |----->|   Rust Compression Engine     |
|   Client App     |  1.  |  (Node.js, Port 3000)    |  2.  |   (Axum, Port 8000)           |
|                  |      |                          |      |                               |
+------------------+      +-----------+--------------+      +--------------+----------------+
                            |           ^      ^                         |
                            |           |      | 3. Compressed Bytes     | 4. JPEG Bytes
                            | 5. Upload |      +-------------------------+
                            v           |
                        +---+-----------+---+
                        |                   |
                        |  Supabase Storage |
                        |                   |
                        +-------------------+
```
**Flow:**
1.  A client sends a `multipart/form-data` request with an image to the Fastify API.
2.  The Fastify API streams the image data in a `POST` request to the Rust service's `/compress` endpoint.
3.  The Rust service compresses the image and streams the resulting JPEG bytes back.
4.  The Fastify API receives the compressed bytes.
5.  Fastify uploads the compressed bytes to a Supabase Storage bucket.
6.  Fastify returns the public Supabase URL to the client.

---

## 2. Service 1: The Rust Compression Engine

This service is a lean, powerful, and specialized HTTP server built with Rust.

### Core Logic (`lib.rs`)

The heart of the service is the `compress_image_bytes` function. It's a pure function that takes raw bytes and a quality setting and returns compressed bytes.

**Compression Pipeline:**
1.  **Decode:** The `image::load_from_memory` function is used to decode the input byte slice. It's powerful because it infers the image format (PNG, WebP, etc.) from the data itself.
2.  **Convert to RGB8:** JPEG doesn't support transparency. The `dynamic_img.into_rgb8()` method converts the image into a pixel format of 8 bits per channel for Red, Green, and Blue, discarding any alpha channel.
3.  **Bridge to `zune-image`:** The `rimage` crate's `mozjpeg` encoder expects data in the `zune_image::Image` format. We construct this struct from the raw RGB8 pixel data, width, height, and color space.
4.  **Encode with `mozjpeg`:** An instance of `MozJpegEncoder` is created with the desired quality. Its `.encode()` method performs the CPU-intensive compression work.
5.  **Return `Result<Vec<u8>>`:** The function returns the compressed `Vec<u8>` on success or a detailed `anyhow::Error` on failure, ensuring robust error handling.

### The Axum Web Server (`main.rs`)

-   **Runtime**: Built on `tokio`, Rust's industry-standard asynchronous runtime, allowing for highly concurrent request handling.
-   **Framework**: `axum` provides the routing and HTTP logic. It's known for its safety, performance, and ergonomic design.
-   **State Management**: `axum::extract::State` is used to manage shared application state, such as atomic counters for metrics, in a thread-safe manner.
-   **Routing**:
    -   `POST /compress`: The main endpoint. It uses an extractor to get the raw `Bytes` of the request body and the `HeaderMap` to read the `X-Compression-Quality` header.
    -   `GET /health`: A simple health check.
    -   `GET /metrics`: Exposes metrics for Prometheus.
-   **Middleware**: `tower-http::TraceLayer` is used to automatically log every incoming request and its outcome, providing excellent visibility.

### Key Dependencies (Rust)
-   `axum`, `tokio`: For the web server and async runtime.
-   `tower-http`: Provides essential HTTP middleware (tracing, cors, timeouts).
-   `image`: For robust, multi-format image decoding.
-   `rimage`, `zune-image`, `zune-core`: The toolchain for high-performance `mozjpeg` compression.
-   `tracing`, `tracing-subscriber`: For structured, asynchronous logging.
-   `metrics`, `metrics-exporter-prometheus`: For collecting and exposing application metrics.
-   `anyhow`: For flexible and developer-friendly error handling.

---

## 3. Service 2: The Fastify API Gateway

This service is the public-facing entry point, designed for scalability and ease of development.

### Application Structure (Fastify)

The code is organized into a modular structure for maintainability:
-   `src/server.js`: Initializes the Fastify server, registers plugins (CORS, rate limiting), and defines routes.
-   `src/config.js`: Centralizes all configuration, reading from environment variables with sensible defaults.
-   `src/middleware.js`: Contains custom middleware, such as the `apiKeyAuth` hook that protects routes.
-   `src/routes/`: Route definitions are separated by concern. `compression.js` handles all logic for the `/compress` endpoint.
-   `src/services/`: Contains the business logic.
    -   `compression.js`: Manages the interaction with the Rust service. It uses `node-fetch` to stream the request body directly to the Rust service, which is highly memory-efficient.
    -   `supabase.js`: Handles the upload of the compressed image buffer to Supabase Storage.

### Request Lifecycle
1.  An incoming request to `/compress` first hits the Fastify server.
2.  The `preHandler` hook for `apiKeyAuth` runs, validating the `x-api-key` header.
3.  The request is passed to the `compression` route handler.
4.  The handler gets the `image` file stream from the multipart request.
5.  This stream is piped directly to the Rust service via a `fetch` call. This avoids loading the entire file into the Node.js service's memory.
6.  The response stream from the Rust service (the compressed JPEG) is converted to a `Buffer`.
7.  This buffer is passed to the Supabase service, which uploads it.
8.  The final URL is returned to the client.

### Key Dependencies (Fastify)
-   `fastify`: The high-performance web framework.
-   `@fastify/cors`, `@fastify/helmet`, `@fastify/rate-limit`: Essential plugins for security.
-   `@fastify/multipart`: For handling file uploads efficiently.
-   `dotenv`: To load environment variables from a `.env` file.
-   `@supabase/supabase-js`: The official client for interacting with Supabase.
-   `node-fetch`: Used to make the server-to-server request to the Rust service.

---

## 4. Observability: Health & Metrics

Both services include `/health` and `/metrics` endpoints.
-   **Health Checks**: A simple `GET /health` endpoint on both services returns a `200 OK` status, which is critical for container orchestrators (like Kubernetes or Docker Swarm) to know if a container is running properly.
-   **Metrics**: Both services expose a `GET /metrics` endpoint that provides data in the **Prometheus** text-based format. This allows a Prometheus server to scrape the endpoints and collect time-series data on application performance, such as:
    -   `http_requests_total`
    -   `http_requests_duration_seconds`
    -   (Custom) `processed_bytes_total`

---

## 5. Containerization & Orchestration

-   **`Dockerfile`**: Each service has its own multi-stage `Dockerfile`.
    -   **Builder Stage**: Installs dependencies and builds the application. For Rust, this is where `cargo build --release` happens.
    -   **Production Stage**: A minimal base image (like `debian:buster-slim`) is used, and only the compiled artifact and necessary assets are copied over. This results in small, secure production images.
-   **`docker-compose.yml`**: This file defines and orchestrates the entire application stack.
    -   It defines the two services (`rust-compressor-service` and `fastify-api`).
    -   It sets up a Docker network, allowing the services to communicate using their service names (e.g., `http://rust-compressor-service:8000`).
    -   It maps the Fastify API's port `3000` to the host machine, making it publicly accessible, while keeping the Rust service's port `8000` internal.
    -   The `build: .` context and `dockerfile:` path tell Docker Compose how to build each service's image.

---

## 6. Error Handling Strategy

-   **Rust Service**: Uses `anyhow::Result` to propagate errors. Any failure in the compression pipeline results in a `500 Internal Server Error` response with a descriptive log message. Invalid inputs (e.g., empty body) result in a `400 Bad Request`.
-   **Fastify API**: Implements centralized error handling. Invalid requests from the client (no API key, no file) are caught and return `4xx` errors. If the Rust service returns an error or the Supabase upload fails, the API catches this and returns a `500 Internal Server Error`, logging the internal error for debugging but not exposing sensitive details to the client.

---

## 7. Security Measures

Security is handled at the API gateway level:
-   **API Key Authentication**: The `x-api-key` header is required for all protected routes. This is a simple but effective way to ensure only authorized clients can use the service.
-   **Rate Limiting**: The `@fastify/rate-limit` plugin is configured to prevent abuse by limiting the number of requests a single IP can make in a given time window.
-   **Helmet**: The `@fastify/helmet` plugin sets various HTTP headers to protect against common web vulnerabilities like Cross-Site Scripting (XSS) and click-jacking.
-   **CORS**: The `@fastify/cors` plugin is configured to only allow requests from whitelisted origins, preventing unauthorized websites from using the API directly from a browser. 