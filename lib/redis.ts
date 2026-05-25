import Redis from "ioredis";

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

// Singleton publisher (for PUBLISH commands)
let pub: Redis | null = null;
export function getPublisher(): Redis {
  if (!pub) pub = new Redis(redisUrl);
  return pub;
}

// Factory: each SSE connection gets its own subscriber instance
// (a subscribed Redis client cannot issue other commands)
export function createSubscriber(): Redis {
  return new Redis(redisUrl);
}
