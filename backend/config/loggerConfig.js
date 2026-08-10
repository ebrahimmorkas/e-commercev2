const pino = require('pino');
const fs = require('fs');
const path = require('path');

const isProd = process.env.NODE_ENV === 'production';

// Ensure logs directory exists
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// File destination (only in production)
const fileStream = pino.destination({
  dest: path.join(logsDir, 'app.log'),
  sync: false
});

// Pretty logging for dev
const transport = !isProd
  ? {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname'
      }
    }
  : undefined;

// Create logger
const logger = pino(
  {
    level: process.env.LOG_LEVEL || 'info',
    base: null, // removes pid, hostname noise
  },
  isProd ? fileStream : pino.transport(transport)
);

module.exports = logger;