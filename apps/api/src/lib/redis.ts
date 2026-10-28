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
  enableOfflineQueue: false,
  connectTimeout: 10_000,
  lazyConnect: false,
});

redis.on("error", (err) => console.error("[redis]", err.message));

export const REFRESH_PREFIX = "auth:refresh:";
export const RATE_PREFIX = "rl:";
export const CACHE_PREFIX = "cache:";
export const PASSWORD_RESET_PREFIX = "auth:password-reset:";
export const PAYMENT_INTENT_PREFIX = "payment:intent:";

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

export async function setPasswordResetToken(token: string, userId: string): Promise<void> {
  await redis.set(`${PASSWORD_RESET_PREFIX}${token}`, userId, "EX", 900);
}

export async function getPasswordResetUser(token: string): Promise<string | null> {
  return redis.get(`${PASSWORD_RESET_PREFIX}${token}`);
}

export async function deletePasswordResetToken(token: string): Promise<void> {
  await redis.del(`${PASSWORD_RESET_PREFIX}${token}`);
}

export async function setPaymentIntent(reference: string, value: string): Promise<void> {
  await redis.set(`${PAYMENT_INTENT_PREFIX}${reference}`, value, "EX", 1800);
}

export async function getPaymentIntent(reference: string): Promise<string | null> {
  return redis.get(`${PAYMENT_INTENT_PREFIX}${reference}`);
}

export async function deletePaymentIntent(reference: string): Promise<void> {
  await redis.del(`${PAYMENT_INTENT_PREFIX}${reference}`);
}
