const { createClient } = require('redis');
const logger = require('../utils/logger.js');

let client = null;

const connectRedis = async () => {
  try {
    if (client && client.isOpen) return client;

    client = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      password: process.env.REDIS_PASSWORD || undefined,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            logger.error("Redis max reconnection attempts reached");
            return new Error('Max reconnection attempts reached');
          }
          return Math.min(retries * 100, 2000);
        },
        connectTimeout: 10000,
      },
    });

    client.on('error', (err) => {
      logger.logInfo("Redis Client Error", { err });
    });

    client.on('ready', () => {
      logger.logInfo("Redis connected");
    });

    client.on('reconnecting', () => {
        logger.logInfo("Redis reconnecitng");
    });

    client.on('end', () => {
      logger.logInfo("Redis connection closed");
    });

    await client.connect();

    return client;
  } catch (err) {
    logger.Exception("Redis connection failed", { err });
    return null; 
  }
};

const getRedisClient = () => {
  if (!client || !client.isOpen) {
    return null; 
  }
  return client;
};

const closeRedis = async () => {
  try {
    if (client && client.isOpen) {
      await client.quit();
      client = null;
      logger.logInfo("Redis connection closed gracefully");
    }
  } catch (err) {
    logger.Exception("Error closing Redis", { err });
  }
};

module.exports = {
  connectRedis,
  getRedisClient,
  closeRedis
};