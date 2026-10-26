import Redis from "ioredis";
import { env } from "../env";

/**
 * Redis is used for:
 * - refresh tokens (rotation + reuse detection)
 * - login rate limiting / failed-attempt counters
 * - short-lived caches (permissions, dashboards)
 */
export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 2,
  lazyConnect: false,
});

redis.on("error", (err) => console.error("[redis]", err.message));

export const REFRESH_PREFIX = "auth:refresh:";
export const RATE_PREFIX = "rl:";
export const CACHE_PREFIX = "cache:";

export async function setRefreshToken(
  userId: string,
  token: string,
  sessionId: string,
): Promise<void> {
  const key = `${REFRESH_PREFIX}${userId}:${token}`;
  await redis.set(key, sessionId, "EX", env.REFRESH_TOKEN_TTL);
}

export async function getRefreshToken(userId: string, token: string): Promise<string | null> {
  return redis.get(`${REFRESH_PREFIX}${userId}:${token}`);
}

export async function deleteRefreshToken(userId: string, token: string): Promise<void> {
  await redis.del(`${REFRESH_PREFIX}${userId}:${token}`);
}

/** Used on password change / logout-everywhere. */
export async function deleteAllRefreshTokens(userId: string): Promise<number> {
  const keys = await redis.keys(`${REFRESH_PREFIX}${userId}:*`);
  if (keys.length) await redis.del(...keys);
  return keys.length;
}

/** Fixed-window counter. Returns { allowed, remaining }. */
export async function rateLimit(
  bucket: string,
  limit: number,
  windowSeconds: number,
): Promise<{ allowed: boolean; remaining: number }> {
  const key = `${RATE_PREFIX}${bucket}`;
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, windowSeconds);
  return { allowed: count <= limit, remaining: Math.max(0, limit - count) };
}
