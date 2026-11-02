import { appPool } from "../db/client";
import { redis } from "./redis";

async function bounded<T>(work: Promise<T>, timeoutMs = 2_000) {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("Dependency check timed out")), timeoutMs); }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function readiness() {
  const startedAt = Date.now();
  const [database, cache] = await Promise.allSettled([
    bounded(appPool.query("select 1")),
    bounded(redis.ping()),
  ]);
  return {
    ok: database.status === "fulfilled" && cache.status === "fulfilled",
    checks: {
      database: database.status === "fulfilled" ? "up" : "down",
      redis: cache.status === "fulfilled" ? "up" : "down",
    },
    durationMs: Date.now() - startedAt,
  };
}