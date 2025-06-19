const { validateFileUpload, generateUniqueFilename, createErrorResponse } = require('../utils');

/**
 * Register compression routes
 * @param {FastifyInstance} fastify - Fastify instance
 * @param {Object} opts - Route options
 */
async function routes(fastify, opts) {
  const { config, compressionService, supabaseService } = fastify;

  // Schema for the compression endpoint
  const schema = {
    body: {
      type: 'object',
      properties: {
        quality: { type: 'number', minimum: 1, maximum: 100 },
        format: { type: 'string', enum: ['jpeg', 'png', 'webp'] }
      }
    },
    response: {
      200: {
        type: 'object',
        properties: {
          url: { type: 'string' },
          key: { type: 'string' },
          size: { type: 'number' },
          originalSize: { type: 'number' },
          compressionRatio: { type: 'number' }
        }
      }
    }
  };

  // Compress and upload endpoint
  fastify.post('/compress', { schema }, async (request, reply) => {
    const data = await request.file();
    
    // Validate file upload
    const validation = validateFileUpload(data, {
      maxSize: config.upload.maxSize,
      allowedMimeTypes: config.upload.allowedMimeTypes
    });

    if (!validation.isValid) {
      return reply.code(400).send(createErrorResponse(
        'Invalid file',
        validation.error,
        'VALIDATION_ERROR'
      ));
    }

    const originalSize = data.file.length;
    const filename = generateUniqueFilename(data.filename);

    try {
      // Compress image
      const compressedBuffer = await compressionService.compressImage(
        data.file,
        {
          quality: request.body?.quality,
          format: request.body?.format
        }
      );

      // Upload to Supabase
      const uploadResult = await supabaseService.uploadFile(
        compressedBuffer,
        filename,
        data.mimetype
      );

      return {
        ...uploadResult,
        originalSize,
        compressionRatio: (originalSize / uploadResult.size).toFixed(2)
      };
    } catch (error) {
      request.log.error(error);
      
      if (error.message.includes('Compression failed')) {
        return reply.code(500).send(createErrorResponse(
          'Compression failed',
          error.message,
          'COMPRESSION_ERROR'
        ));
      }

      return reply.code(500).send(createErrorResponse(
        'Upload failed',
        error.message,
        'UPLOAD_ERROR'
      ));
    }
  });

  // Health check endpoint
  fastify.get('/health', async (request, reply) => {
    try {
      const health = await compressionService.getHealth();
      return { status: 'ok', ...health };
    } catch (error) {
      request.log.error(error);
      return reply.code(503).send(createErrorResponse(
        'Service unavailable',
        error.message,
        'HEALTH_CHECK_ERROR'
      ));
    }
  });

  // Metrics endpoint
  fastify.get('/metrics', async (request, reply) => {
    try {
      const metrics = await compressionService.getMetrics();
      return metrics;
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send(createErrorResponse(
        'Metrics unavailable',
        error.message,
        'METRICS_ERROR'
      ));
    }
  });
}

module.exports = routes; 