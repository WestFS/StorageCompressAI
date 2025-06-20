# Stage 1: Build the application
FROM rust:latest as builder

# Install necessary build tools for C/C++ dependencies like libaom
RUN apt-get update && apt-get install -y build-essential cmake yasm nasm

WORKDIR /app

# Copy only the manifest to cache dependencies
COPY Cargo.toml ./

# Build a dummy project to generate Cargo.lock and fetch/build dependencies
RUN mkdir src && \
    echo "fn main() {}" > src/main.rs && \
    cargo build --release && \
    rm -rf src target/release/deps/image_compressor_rust_service*

# Copy the actual source code
COPY src ./src

# Build the real application using cached dependencies
RUN cargo build --release

# Stage 2: Create the final, minimal image
FROM debian:bookworm-slim

WORKDIR /app

# Copy the compiled binary from the builder stage
COPY --from=builder /app/target/release/image-compressor-rust-service /usr/local/bin/image-compressor-rust-service

# Expose the port the server listens on
EXPOSE 8000

# Set the command to run the service
CMD ["image-compressor-rust-service"]
