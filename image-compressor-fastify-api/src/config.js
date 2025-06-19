const env = process.env.NODE_ENV || 'development';

const config = {
  env,
  isProduction: env === 'production',
  isDevelopment: env === 'development',

  server: {
    host: process.env.HOST || '0.0.0.0',
    port: parseInt(process.env.PORT || '3000', 10),
    cors: {
      origin: process.env.CORS_ORIGIN === 'true' ? true : process.env.CORS_ORIGIN || false,
      credentials: true
    }
  },

  rust: {
    serviceUrl: process.env.RUST_SERVICE_URL || 'http://rust-compressor-service:8000',
    timeout: parseInt(process.env.RUST_SERVICE_TIMEOUT || '30000', 10) // 30 seconds
  },

  supabase: {
    url: process.env.SUPABASE_URL,
    key: process.env.SUPABASE_KEY,
    bucket: process.env.SUPABASE_BUCKET || 'images',
    uploadPath: process.env.SUPABASE_UPLOAD_PATH || 'compressed'
  },

  upload: {
    maxSize: parseInt(process.env.MAX_FILE_SIZE || '10485760', 10), // 10MB
    allowedMimeTypes: (process.env.ALLOWED_MIME_TYPES || 'image/jpeg,image/png,image/webp')
      .split(',')
      .map(type => type.trim()),
    defaultQuality: parseInt(process.env.DEFAULT_QUALITY || '80', 10)
  },

  security: {
    rateLimit: {
      max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10), // requests
      timeWindow: parseInt(process.env.RATE_LIMIT_WINDOW || '900000', 10) // 15 minutes
    },
    apiKey: process.env.API_KEY || null
  },

  logging: {
    level: process.env.LOG_LEVEL || 'info',
    prettyPrint: process.env.NODE_ENV !== 'production'
  }
};

// Validate required configuration
const requiredConfig = {
  'SUPABASE_URL': config.supabase.url,
  'SUPABASE_KEY': config.supabase.key
};

Object.entries(requiredConfig).forEach(([key, value]) => {
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
});

module.exports = config; 