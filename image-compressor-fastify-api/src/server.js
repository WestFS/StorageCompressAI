const fastify = require('fastify')({ 
  logger: {
    level: process.env.LOG_LEVEL || 'info',
    serializers: {
      req(request) {
        return {
          method: request.method,
          url: request.url,
          hostname: request.hostname,
          remoteAddress: request.ip,
          remotePort: request.socket.remotePort
        };
      }
    }
  }
});

const config = require('./config');
const { apiKeyAuth, requestLogger } = require('./middleware');
const CompressionService = require('./services/compression');
const SupabaseService = require('./services/supabase');

// Validate required configuration
if (!config.supabase.url || !config.supabase.key) {
  fastify.log.error('Missing required Supabase configuration');
  process.exit(1);
}

// Register plugins
async function registerPlugins() {
  await fastify.register(require('@fastify/cors'), config.server.cors);
  await fastify.register(require('@fastify/multipart'), {
    limits: {
      fileSize: config.upload.maxSize
    }
  });
  await fastify.register(require('@fastify/rate-limit'), {
    max: config.rateLimit.max,
    timeWindow: config.rateLimit.timeWindow
  });
  await fastify.register(require('@fastify/helmet'));
}

// Initialize services
function initializeServices() {
  const compressionService = new CompressionService(config);
  const supabaseService = new SupabaseService(config);

  // Make services available in Fastify instance
  fastify.decorate('config', config);
  fastify.decorate('compressionService', compressionService);
  fastify.decorate('supabaseService', supabaseService);
}

// Register routes
async function registerRoutes() {
  // Add global middlewares
  fastify.addHook('onRequest', requestLogger(config));
  if (config.security.apiKey) {
    fastify.addHook('onRequest', apiKeyAuth(config));
  }

  // Register route handlers
  await fastify.register(require('./routes/compression'), { prefix: '/api/v1' });
}

// Graceful shutdown
async function closeGracefully(signal) {
  fastify.log.info(`Received signal to terminate: ${signal}`);

  await fastify.close();
  process.exit(0);
}

process.on('SIGINT', closeGracefully);
process.on('SIGTERM', closeGracefully);
process.on('unhandledRejection', (err) => {
  fastify.log.error(err);
  process.exit(1);
});

// Start server
async function start() {
  try {
    await registerPlugins();
    initializeServices();
    await registerRoutes();

    const address = await fastify.listen({
      port: config.server.port,
      host: config.server.host
    });

    fastify.log.info(`Server listening on ${address}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

start();
