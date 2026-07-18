const { getRedisClient } = require('../config/redisConfig');
const logger = require('../utils/logger.js');

const DEFAULT_TTL = 3600;

class RedisService {
  isRedisEnabled() {
    return process.env.IS_REDIS_SERVER_ON === "1";
  }

  getClient() {
    const client = getRedisClient();

    if (!client) {
      logger.warn("Redis not available");
      return null;
    }

    return client;
  }

  validateKey(key) {
    if (!key || typeof key !== "string") {
        logger.logInfo("Invald redis key", {key});
    }
  }

  safeParse(data, key) {
    try {
      return JSON.parse(data);
    } catch (err) {
      logger.logException("Invalid JSON in Redis", { key, data });
      return null;
    }
  }

  async get(key) {
    try {
      this.validateKey(key);

      if (!this.isRedisEnabled()) return null;

      const client = this.getClient();
      if (!client) return null;

      const data = await client.get(key);

      if (data === null) {
        logger.logInfo("Cache MISS", { key });
        return null;
      }

      logger.logInfo("Cache HIT", { key });

      return this.safeParse(data, key);
    } catch (err) {
      logger.logException("Redis GET error", { key, err });
      return null;
    }
  }

  async set(key, value, ttl = DEFAULT_TTL) {
    try {
      this.validateKey(key);

      if (!this.isRedisEnabled()) return false;

      const client = this.getClient();
      if (!client) return false;

      if (ttl <= 0) ttl = DEFAULT_TTL;

      await client.setEx(key, ttl, JSON.stringify(value));

      logger.logInfo("Cache SET", { key, ttl });

      return true;
    } catch (err) {
      logger.logException("Redis SET error", { key, err });
      return false;
    }
  }

  async del(key) {
    try {
      this.validateKey(key);

      if (!this.isRedisEnabled()) return false;

      const client = this.getClient();
      if (!client) return false;

      await client.del(key);

      logger.logInfo("Cache DEL", { key });

      return true;
    } catch (err) {
      logger.Exception("Redis DEL error", { key, err });
      return false;
    }
  }

  async getOrSet(key, fetchFunction, ttl = DEFAULT_TTL) {
    try {
      this.validateKey(key);

      const cached = await this.get(key);

      console.log(`${key} and now ${cached}`);

      if (cached !== null) return cached;

      logger.logInfo("Cache MISS - fetching", { key });

      // console.log(`30 jun 1 ${fetchFunction}`);

      const freshData = await fetchFunction();

      if (freshData !== null && freshData !== undefined) {
        await this.set(key, freshData, ttl);
      }

      return freshData;
    } catch (err) {
      logger.Exception("Redis getOrSet error", { key, err });

      try {
        return await fetchFunction();
      } catch (fetchErr) {
        logger.Exception("Fallback fetch failed", { key, fetchErr });
        throw fetchErr;
      }
    }
  }
}

module.exports = new RedisService();