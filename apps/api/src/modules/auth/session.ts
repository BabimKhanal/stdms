import { randomBytes } from "node:crypto";
import {
  deleteAllRefreshTokens as redisDeleteAll,
  deleteRefreshToken as redisDelete,
  getRefreshToken as redisGet,
  setRefreshToken as redisSet,
} from "../../lib/redis";

/** Refresh tokens are opaque 64-char random strings (never guessable). */
export const randomToken = () => randomBytes(32).toString("hex");

/** What we remember about a refresh session in Redis (7-day TTL). */
export type SessionData = { org: string | null; pa: boolean };

export async function saveSession(userId: string, token: string, data: SessionData) {
  await redisSet(userId, token, JSON.stringify(data));
}

export async function readSession(userId: string, token: string): Promise<SessionData | null> {
  const raw = await redisGet(userId, token);
  if (!raw) return null;
  return JSON.parse(raw) as SessionData;
}

export async function revokeSession(userId: string, token: string) {
  await redisDelete(userId, token);
}

export async function revokeAllSessions(userId: string) {
  await redisDeleteAll(userId);
}
