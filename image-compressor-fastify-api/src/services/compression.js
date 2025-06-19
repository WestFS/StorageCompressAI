class CompressionService {
  constructor(config) {
    this.config = config;
    this.serviceUrl = config.rust.serviceUrl;
    this.timeout = config.rust.timeout;
  }

  /**
   * Compress an image using the Rust service
   * @param {Buffer|ReadableStream} imageData - Image data to compress
   * @param {Object} options - Compression options
   * @returns {Promise<Buffer>} Compressed image data
   */
  async compressImage(imageData, options = {}) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.serviceUrl}/compress`, {
        method: 'POST',
        body: imageData,
        headers: {
          'Content-Type': 'application/octet-stream',
          ...(options.quality && { 'X-Compression-Quality': options.quality.toString() }),
          ...(options.format && { 'X-Output-Format': options.format })
        },
        signal: controller.signal
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Compression failed: ${error}`);
      }

      return await response.arrayBuffer().then(Buffer.from);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Get service health status
   * @returns {Promise<Object>} Health status
   */
  async getHealth() {
    const response = await fetch(`${this.serviceUrl}/health`, {
      method: 'GET'
    });

    if (!response.ok) {
      throw new Error('Health check failed');
    }

    return await response.json();
  }

  /**
   * Get service metrics
   * @returns {Promise<Object>} Service metrics
   */
  async getMetrics() {
    const response = await fetch(`${this.serviceUrl}/metrics`, {
      method: 'GET'
    });

    if (!response.ok) {
      throw new Error('Metrics fetch failed');
    }

    return await response.json();
  }
}

module.exports = CompressionService; 