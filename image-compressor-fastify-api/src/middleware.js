const { createErrorResponse } = require('./utils');

/**
 * API Key authentication middleware
 * @param {Object} config - Configuration object
 * @returns {Function} Fastify middleware function
 */
function apiKeyAuth(config) {
  return async function (request, reply) {
    if (!config.security.apiKey) {
      return; // Skip if no API key is configured
    }

    const apiKey = request.headers['x-api-key'];
    if (!apiKey || apiKey !== config.security.apiKey) {
      reply.code(401).send(createErrorResponse(
        'Unauthorized',
        'Invalid or missing API key',
        'AUTH_ERROR'
      ));
    }
  };
}

/**
 * Request logging middleware
 * @param {Object} config - Configuration object
 * @returns {Function} Fastify middleware function
 */
function requestLogger(config) {
  return async function (request, reply) {
    const startTime = process.hrtime();

    reply.on('finish', () => {
      const [seconds, nanoseconds] = process.hrtime(startTime);
      const duration = seconds * 1000 + nanoseconds / 1e6; // Convert to milliseconds

      request.log.info({
        method: request.method,
        url: request.url,
        statusCode: reply.statusCode,
        duration: `${duration.toFixed(2)}ms`,
        ...(config.isDevelopment && {
          headers: request.headers,
          query: request.query,
          params: request.params
        })
      });
    });
  };
}

/**
 * Error handling middleware
 * @returns {Function} Fastify error handler
 */
function errorHandler() {
  return function (error, request, reply) {
    request.log.error(error);

    // Handle specific error types
    if (error.validation) {
      return reply.code(400).send(createErrorResponse(
        'Validation Error',
        error.validation,
        'VALIDATION_ERROR'
      ));
    }

    if (error.statusCode) {
      return reply.code(error.statusCode).send(createErrorResponse(
        error.message,
        error.details || null,
        error.code || 'API_ERROR'
      ));
    }

    // Default error response
    reply.code(500).send(createErrorResponse(
      'Internal Server Error',
      process.env.NODE_ENV === 'development' ? error.message : null,
      'SERVER_ERROR'
    ));
  };
}

/**
 * Not found handler middleware
 * @returns {Function} Fastify not found handler
 */
function notFoundHandler() {
  return function (request, reply) {
    reply.code(404).send(createErrorResponse(
      'Not Found',
      `Route ${request.method}:${request.url} not found`,
      'NOT_FOUND'
    ));
  };
}

module.exports = {
  apiKeyAuth,
  requestLogger,
  errorHandler,
  notFoundHandler
}; 