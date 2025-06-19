# Stage 1: Build the application
FROM rust:1.74 as builder

WORKDIR /app

# Copy dependencies manifest and fetch them to cache the layer
COPY Cargo.toml Cargo.lock ./
RUN mkdir src && \
    echo "fn main() {}" > src/main.rs && \
    cargo build --release && \
    rm -rf src

# Copy the rest of the application source code
COPY . .

# Build the application
RUN cargo build --release

# Stage 2: Create the final, minimal image
FROM debian:bullseye-slim

WORKDIR /app

# Copy the compiled binary from the builder stage
COPY --from=builder /app/target/release/image-compressor-rust-service /usr/local/bin/image-compressor-rust-service

# Expose the port the server listens on
EXPOSE 8000

# Set the command to run the service
CMD ["image-compressor-rust-service"]
