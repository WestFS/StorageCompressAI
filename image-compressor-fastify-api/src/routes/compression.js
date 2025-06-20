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

    // Convert the file stream to a buffer before processing
    const imageBuffer = await data.toBuffer();
    const originalSize = imageBuffer.length;
    const filename = generateUniqueFilename(data.filename);

    try {
      // Compress image using the buffer
      const compressedBuffer = await compressionService.compressImage(
        imageBuffer,
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

      reply.header('Content-Type', 'image/jpeg');
      return reply.send(compressedBuffer);
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