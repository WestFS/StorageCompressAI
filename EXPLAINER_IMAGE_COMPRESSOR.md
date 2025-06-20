# Explainer: The Rust Image Compression Service

## Overview

This document explains the `image-compressor-rust-service`, a high-performance microservice built in Rust. Its sole purpose is to receive raw image data, compress it efficiently, and return the compressed bytes. It is designed to be a fast, reliable, and specialized engine within a larger system.

---

## What It Does

- **Input:** Raw image data (bytes) of various formats (PNG, JPEG, WebP, etc.).
- **Processing:** It decodes the input, converts it to a format suitable for JPEG compression, and then uses the `image` crate to perform high-quality, efficient JPEG compression.
- **Output:** Raw JPEG image data (bytes).
- **Why Rust?** Rust was chosen for its performance, memory safety, and excellent concurrency, making it ideal for a CPU-intensive task like image compression.

---

## The Compression Pipeline

The service follows a clear, multi-step process for every image:

1.  **Decode:** The raw input bytes are decoded using the `image` crate, which automatically detects the original format (e.g., PNG, WebP).
2.  **Compress to JPEG:** The decoded image is encoded diretamente para JPEG usando a própria `image` crate, com o nível de qualidade especificado.
3.  **Return Bytes:** The resulting compressed JPEG bytes are sent back as the HTTP response.

---

## Project Structure (`image-compressor-rust-service/`)

-   **`src/main.rs`**: This is the entry point for the web server. It sets up the `axum` web framework, defines the HTTP routes (`/compress`, `/health`, `/metrics`), initializes logging (`tracing`), and manages the server's shared state.
-   **`src/lib.rs`**: This file contains the core business logic. The `compress_image_bytes` function lives here, encapsulating the entire compression pipeline described above. This separation makes the logic reusable and easy to test independently.
-   **`Cargo.toml`**: This is the manifest file for the Rust project. It defines all dependencies (`axum`, `tokio`, `image`, `tracing`, `metrics`, etc.), metadata, and build profiles.
-   **`Dockerfile`**: A multi-stage Dockerfile that first builds the Rust application in a builder container and then copies the compiled binary into a minimal, clean production container for a small and secure final image.

---

## HTTP Endpoints (Internal)

These endpoints are designed to be called by other services (like the Fastify API gateway) within the Docker network.

-   **`POST /compress`**:
    -   Expects raw image bytes in the request body.
    -   Expects an optional `X-Compression-Quality` header (a number from 1-100, defaults to 80).
    -   Returns raw JPEG bytes with a `Content-Type: image/jpeg` header on success.
    -   Returns an appropriate HTTP error code (e.g., `400` or `500`) on failure.
-   **`GET /health`**: A simple health check endpoint that returns `200 OK` with a JSON body `{"status":"ok"}` if the service is running.
-   **`GET /metrics`**: Exposes application metrics (like requests handled and bytes processed) in a Prometheus-compatible format.

---

## Key Dependencies & Concepts

-   **`axum`**: A modern, ergonomic web framework for building HTTP services in Rust. It's built on top of `tokio`.
-   **`tokio`**: The standard asynchronous runtime for Rust, providing the foundation for `axum` to handle thousands of concurrent requests efficiently.
-   **`image`**: A powerful image processing library used for decoding a wide variety of formats and for JPEG encoding/compression.
-   **`tracing`**: A structured, asynchronous-friendly logging framework used throughout the application to provide detailed operational insights.
-   **`metrics`**: A lightweight library for collecting application metrics, which are then exposed for monitoring systems like Prometheus.
-   **`Result<T, E>` & `anyhow`**: The project uses Rust's standard `Result` type for robust error handling, enhanced by the `anyhow` crate for adding context to errors, making debugging easier.

---

## How It Integrates

This service is not meant to be used directly by end-users or web browsers. It is a **microservice**. In this project, the `image-compressor-fastify-api` service acts as the public gateway.

1.  A user uploads an image to the Fastify API.
2.  The Fastify API forwards the raw image data to this Rust service's `/compress` endpoint.
3.  This Rust service performs the heavy lifting of compression and returns the JPEG data.
4.  The Fastify API receives the compressed data and proceeds with its next steps (like uploading to Supabase).

This architecture separates concerns, allowing each service to be optimized and scaled independently. The Rust service can focus entirely on CPU-bound compression, while the Node.js service handles I/O-bound tasks like network requests and authentication.

---

## Key Rust Concepts Explained

- **Crate:** A Rust package/library. This project is a crate.
- **Module:** A file or folder of Rust code (e.g., `lib.rs`, `main.rs`).
- **Result<T, E>:** Rust's way of handling errors. `Ok(value)` for success, `Err(error)` for failure.
- **Context:** Adds extra info to errors for easier debugging.
- **Vec<u8>:** A growable array of bytes (used for image data).
- **Dependency:** External code you use (see `Cargo.toml`).
- **Docker:** Lets you run the service in a container, isolated from your system.

---

## Example Flow (End-to-End)

1. **User uploads an image (PNG) via a web/mobile app.**
2. **Fastify backend receives the image, sends it to the Rust HTTP service.**
3. **Rust service compresses the image and returns a JPEG.**
4. **Fastify uploads the JPEG to Supabase Storage.**
5. **App receives the URL to the compressed image.**

---

## Glossary

- **JPEG:** A common image format for photos, supports lossy compression.
- **PNG:** Image format with lossless compression and transparency.
- **Compression:** Reducing file size by removing redundant data.
- **RGB8:** 8 bits per color channel (Red, Green, Blue), no alpha.
- **Alpha channel:** Transparency info in images (not supported by JPEG).
- **Encoder:** Software that converts raw data to a compressed format.
- **HTTP multipart:** A way to upload files via HTTP POST.
- **Supabase:** A backend-as-a-service platform, used here for image storage.

---

## Further Learning

- [The Rust Book](https://doc.rust-lang.org/book/)
- [Rust By Example](https://doc.rust-lang.org/rust-by-example/)
- [Crate: image](https://crates.io/crates/image)
- [Crate: rimage](https://crates.io/crates/rimage)
- [Crate: axum](https://crates.io/crates/axum)
- [Crate: anyhow](https://crates.io/crates/anyhow)
- [Docker Getting Started](https://docs.docker.com/get-started/)
- [Supabase Docs](https://supabase.com/docs)

---

## Gotchas for Beginners

- Rust is strict about types and error handling—embrace `Result` and `?`.
- JPEG does not support transparency; alpha channels are dropped.
- Always check error messages—they are usually very descriptive.
- If using Docker, make sure ports are mapped correctly.
- If you get "unsupported format" errors, check if the input image is valid and supported by the `image` crate.

---

## Questions?

If you get stuck, check the error messages, read the Rust Book, or ask for help in the Rust community! 