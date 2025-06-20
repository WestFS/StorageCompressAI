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
  notFoundHandler
}; 