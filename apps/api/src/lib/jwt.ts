import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../env";

/**
 * Minimal HS256 JWT implementation (sign + verify) using only node:crypto.
 * Keeping it dependency-free makes the auth flow readable end-to-end.
 */

export type JwtPayload = Record<string, unknown> & {
  sub: string;
  iat: number;
  exp: number;
};

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function hmac(input: string, secret: string): string {
  return createHmac("sha256", secret).update(input).digest("base64url");
}

export function signJwt(
  payload: Record<string, unknown>,
  secret: string,
  ttlSeconds: number,
): string {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64url(JSON.stringify({ ...payload, iat: now, exp: now + ttlSeconds }));
  const signature = hmac(`${header}.${body}`, secret);
  return `${header}.${body}.${signature}`;
}

export function verifyJwt(token: string, secret: string): JwtPayload {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Malformed token");
  const [header, body, signature] = parts;
  const expected = hmac(`${header}.${body}`, secret);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new Error("Invalid signature");
  const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as JwtPayload;
  if (typeof payload.exp !== "number" || payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error("Token expired");
  }
  return payload;
}

export function signAccessToken(claims: {
  sub: string;
  org: string | null;
  pa?: boolean;
}): { token: string; expiresIn: number } {
  return {
    token: signJwt(
      { sub: claims.sub, org: claims.org, pa: claims.pa ?? false },
      env.JWT_ACCESS_SECRET,
      env.ACCESS_TOKEN_TTL,
    ),
    expiresIn: env.ACCESS_TOKEN_TTL,
  };
}

export function verifyAccessToken(token: string): JwtPayload {
  return verifyJwt(token, env.JWT_ACCESS_SECRET);
}
