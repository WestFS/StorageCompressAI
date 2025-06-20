// image-compressor-rust-service/src/lib.rs

use anyhow::{Context, Result};
use image::ImageOutputFormat;
use std::io::Cursor;
use metrics_exporter_prometheus::PrometheusHandle;
use std::sync::Arc;
use metrics;

/// Compresses an image from a byte slice to JPEG format using the `image` crate.
///
/// This simplified function relies entirely on the stable `image` crate for both
/// decoding and encoding, removing the complexity of unstable dependencies.
///
/// # Arguments
///
/// * `input_bytes` - A byte slice `&[u8]` containing the raw data of the input image.
/// * `quality` - A `u8` value from 1 to 100 representing the desired JPEG quality.
///
/// # Returns
///
/// * `Result<Vec<u8>>` - On success, returns a `Vec<u8>` with the compressed JPEG data.
///   On failure, returns an `anyhow::Error` detailing the cause of the failure.
///
pub fn compress_image_bytes(input_bytes: &[u8], quality: u8) -> Result<Vec<u8>> {
    metrics::increment_counter!("compress_requests_total");

    // Step 1: Decode the input image from memory.
    // The `image` crate automatically detects the format.
    let dynamic_img = image::load_from_memory(input_bytes)
        .context("Failed to decode input image. The format may be unsupported or the data is corrupted.")?;

    // Step 2: Create a buffer to hold the compressed image data.
    let mut buffer = Vec::new();
    // `Cursor` allows us to treat the `Vec<u8>` buffer as a writable stream.
    let mut writer = Cursor::new(&mut buffer);

    // Step 3: Write the image to the buffer in JPEG format with the specified quality.
    // The `image` crate handles the encoding internally.
    dynamic_img
        .write_to(&mut writer, ImageOutputFormat::Jpeg(quality))
        .context("Failed to encode image to JPEG format.")?;

    // The buffer is now filled with the compressed JPEG data.
    Ok(buffer)
}