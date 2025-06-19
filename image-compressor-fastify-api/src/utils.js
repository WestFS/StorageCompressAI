const crypto = require('crypto');
const path = require('path');

/**
 * Generate a unique filename with timestamp and random hash
 * @param {string} originalFilename - The original filename
 * @returns {string} The unique filename
 */
function generateUniqueFilename(originalFilename) {
  const timestamp = Date.now();
  const hash = crypto.randomBytes(8).toString('hex');
  const ext = path.extname(originalFilename);
  const name = path.basename(originalFilename, ext);
  return `${name}-${timestamp}-${hash}${ext}`;
}

/**
 * Validate file upload
 * @param {Object} file - The file object from fastify-multipart
 * @param {Object} options - Validation options
 * @returns {Object} Validation result { isValid, error }
 */
function validateFileUpload(file, { maxSize, allowedMimeTypes }) {
  if (!file) {
    return { isValid: false, error: 'No file provided' };
  }

  if (!allowedMimeTypes.includes(file.mimetype)) {
    return {
      isValid: false,
      error: `Invalid file type. Allowed types: ${allowedMimeTypes.join(', ')}`
    };
  }

  if (file.file.bytesRead > maxSize) {
    return {
      isValid: false,
      error: `File too large. Maximum size allowed: ${formatBytes(maxSize)}`
    };
  }

  return { isValid: true };
}

/**
 * Format bytes to human readable string
 * @param {number} bytes - The number of bytes
 * @returns {string} Formatted string
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Create error response object
 * @param {string} message - Error message
 * @param {string} details - Error details
 * @param {string} code - Error code
 * @returns {Object} Error response object
 */
function createErrorResponse(message, details = null, code = null) {
  return {
    error: true,
    message,
    ...(details && { details }),
    ...(code && { code })
  };
}

/**
 * Create success response object
 * @param {Object} data - Response data
 * @param {string} message - Success message
 * @returns {Object} Success response object
 */
function createSuccessResponse(data, message = 'Operation successful') {
  return {
    success: true,
    message,
    data
  };
}

/**
 * Parse quality parameter
 * @param {string|number} quality - Quality parameter from request
 * @param {number} defaultQuality - Default quality value
 * @returns {number} Parsed quality value
 */
function parseQuality(quality, defaultQuality) {
  const parsed = parseInt(quality);
  if (isNaN(parsed) || parsed < 1 || parsed > 100) {
    return defaultQuality;
  }
  return parsed;
}

module.exports = {
  generateUniqueFilename,
  validateFileUpload,
  formatBytes,
  createErrorResponse,
  createSuccessResponse,
  parseQuality
}; 