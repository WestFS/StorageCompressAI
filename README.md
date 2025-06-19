# StorageCompressAI: An Image Compression Microservice

This project provides a high-performance image compression solution using a microservice architecture. It features a core compression engine built in Rust for speed and efficiency, and a robust API gateway built with Node.js (Fastify) for handling uploads, security, and cloud storage integration with Supabase.

## Key Features

- **High-Performance Compression**: Leverates Rust's performance with `mozjpeg` for efficient JPEG compression.
- **Robust API**: A Fastify-based API provides a secure and scalable entry point for all operations.
- **Cloud Integration**: Seamlessly uploads compressed images to Supabase Storage.
- **Containerized**: Fully containerized with Docker and orchestrated with Docker Compose for easy deployment and scalability.
- **Observability**: Both services expose health check and Prometheus-compatible metrics endpoints.
- **Secure**: The API includes rate limiting and API key authentication.

## Project Structure

```
/
├── image-compressor-rust-service/    # Rust Compression Service (Axum)
│   ├── src/
│   │   ├── lib.rs                   # Core compression logic
│   │   └── main.rs                  # Axum web server
│   ├── Cargo.toml                   # Rust dependencies
│   └── Dockerfile                   # Docker configuration for Rust service
│
├── image-compressor-fastify-api/     # Node.js API Gateway (Fastify)
│   ├── src/
│   │   ├── server.js                # Fastify server entry point
│   │   ├── config.js                # Configuration management
│   │   ├── middleware.js            # Custom middleware (auth, etc.)
│   │   ├── routes/compression.js    # Compression route handling
│   │   └── services/                # Business logic (compression, supabase)
│   ├── package.json                 # Node.js dependencies
│   ├── .env.example                 # Environment variables template
│   └── Dockerfile                   # Docker configuration for Node.js service
│
├── .dockerignore
├── docker-compose.yml               # Orchestrates all services
└── README.md
```

## Services

### 1. Rust Compression Service (`image-compressor-rust-service`)

- **Framework**: Rust with [Axum](https://github.com/tokio-rs/axum).
- **Functionality**: Receives raw image data and performs compression. It's a pure processing engine designed for speed.
- **Dependencies**: Key dependencies include `axum`, `tokio`, `image`, `rimage` (for mozjpeg), `tracing` (for logging), and `metrics`.
- **Port**: `8000` (internal to Docker network).

### 2. Fastify API Service (`image-compressor-fastify-api`)

- **Framework**: Node.js with [Fastify](https://www.fastify.io/).
- **Functionality**: Acts as the public-facing gateway. It handles multipart file uploads, validates inputs, communicates with the Rust service for compression, and uploads the final result to Supabase.
- **Security**: Implements API key authentication and rate limiting.
- **Port**: `3000` (exposed to the host).

## Prerequisites

- Docker and Docker Compose
- Node.js v18+ (for local development without Docker)
- Rust toolchain (for local development without Docker)
- A Supabase account and a storage bucket.

## Getting Started

### 1. Clone the Repository
```bash
git clone https://github.com/WestFS/StorageCompressAI.git
cd StorageCompressAI
```

### 2. Configure Environment Variables
Copy the example environment file for the Fastify API and fill in your details.
```bash
cd image-compressor-fastify-api
cp .env.example .env
```
Now, edit the `.env` file with your Supabase URL, Supabase public API key, and a secure `API_KEY` for your service.

### 3. Build and Run with Docker Compose
From the project's root directory, build and start the services in detached mode:
```bash
docker-compose up --build -d
```
The API will be accessible at `http://localhost:3000`.

## API Endpoints

### Fastify API (`http://localhost:3000`)

#### `POST /compress`
Compresses and uploads an image.

- **Headers**:
  - `x-api-key`: Your secret API key.
- **Body**: `multipart/form-data`
  - `image`: The image file to be compressed.
  - `quality` (optional): A number between 1 and 100. Defaults to `80`.
- **Success Response (`200 OK`)**:
  ```json
  {
    "url": "https://<your-supabase-url>/storage/v1/object/public/<bucket>/<image-name>.jpg"
  }
  ```
- **Error Responses**:
  - `400 Bad Request`: Missing or invalid image file.
  - `401 Unauthorized`: Missing or invalid API key.
  - `429 Too Many Requests`: Rate limit exceeded.
  - `500 Internal Server Error`: Compression or upload failed.

#### `GET /health`
Returns the operational status of the API.
- **Success Response (`200 OK`)**: `{"status":"ok"}`

#### `GET /metrics`
Exposes Prometheus-compatible metrics.

### Rust Service (Internal)

The Rust service (`compressor-engine`) runs on port `8000` within the Docker network and is not publicly accessible. It exposes the following internal endpoints: `/compress`, `/health`, and `/metrics`.

## Local Development (Without Docker)

If you prefer to run the services directly on your machine:

### 1. Run the Rust Service
```bash
cd image-compressor-rust-service
cargo run
```

### 2. Run the Fastify API
In a separate terminal:
```bash
cd image-compressor-fastify-api
npm install
# Ensure your .env file is configured correctly,
# especially RUST_SERVICE_URL=http://localhost:8000
npm run dev
```

## Building Docker Images Manually

You can build the Docker image for each service individually.

```bash
# Build Rust Service
docker build -t storagecompressai/compressor-engine:latest ./image-compressor-rust-service

# Build Fastify API
docker build -t storagecompressai/api-gateway:latest ./image-compressor-fastify-api
```

## Contributing

Contributions are welcome! Please follow these steps:
1. Fork the repository.
2. Create a new feature branch (`git checkout -b feature/your-amazing-feature`).
3. Commit your changes (`git commit -m 'Add some amazing feature'`).
4. Push to the branch (`git push origin feature/your-amazing-feature`).
5. Open a Pull Request.

## License

This project is licensed under the MIT License.
