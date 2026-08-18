const Redis = require("ioredis");
const logger = require("./logger");

const cacheStore = {};
let redisClient = null;
let pubSubClient = null;
let isRedisConnected = false;

if (process.env.REDIS_URL && process.env.NODE_ENV !== "test") {
  try {
    const redisOptions = {
      maxRetriesPerRequest: 1,
      retryStrategy(times) {
        if (times > 3) {
          logger.warn("🔌 Redis connection failed repeatedly. Falling back to local in-memory cache.");
          return null; // Stop retrying and fallback
        }
        return Math.min(times * 100, 2000);
      }
    };
    
    redisClient = new Redis(process.env.REDIS_URL, redisOptions);
    pubSubClient = new Redis(process.env.REDIS_URL, redisOptions);
    
    redisClient.on("connect", () => {
      isRedisConnected = true;
      logger.info("🔌 Redis client connected successfully");
    });
    
    redisClient.on("error", (err) => {
      isRedisConnected = false;
      logger.error("🔌 Redis client error:", err.message || err);
    });
    
    pubSubClient.on("connect", () => {
      pubSubClient.subscribe("lyvo-cache-invalidation", (err) => {
        if (err) logger.error("🔌 Pub/Sub subscription failed:", err);
      });
    });
    
    pubSubClient.on("message", (channel, message) => {
      if (channel === "lyvo-cache-invalidation" && message === "clear") {
        localClear();
      }
    });
  } catch (err) {
    logger.error("🔌 Redis connection failed to initialize:", err);
  }
}

const localClear = () => {
  for (const key in cacheStore) {
    delete cacheStore[key];
  }
};

exports.set = (key, value, ttlSeconds = 300) => {
  const expiresAt = Date.now() + (ttlSeconds * 1000);
  cacheStore[key] = { value, expiresAt };
  
  if (isRedisConnected && redisClient) {
    redisClient.set(key, JSON.stringify(value), "EX", ttlSeconds).catch((err) => {
      logger.warn(`Redis set error for key ${key}:`, err.message);
    });
  }
};

exports.get = (key) => {
  const item = cacheStore[key];
  if (item && Date.now() <= item.expiresAt) {
    return item.value;
  }
  
  if (item) {
    delete cacheStore[key];
  }
  
  return null;
};

exports.clear = () => {
  localClear();
  
  if (isRedisConnected && redisClient) {
    redisClient.publish("lyvo-cache-invalidation", "clear").catch((err) => {
      logger.warn("Redis pub/sub publish failed:", err.message);
    });
  }
};
