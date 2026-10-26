import dotenv from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

dotenv.config({
  path: resolve(dirname(fileURLToPath(import.meta.url)), "../.env"),
});

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  PORT: z.coerce.number().default(4001),

  HOST: z.string().default("0.0.0.0"),

  WEB_ORIGIN: z.string().default("http://localhost:3000"),

  DATABASE_URL: z.string().min(1),

  APP_DATABASE_URL: z.string().min(1),

  REDIS_URL: z.string().default("redis://localhost:6379"),

  JWT_ACCESS_SECRET: z.string().min(16),

  JWT_REFRESH_SECRET: z.string().min(16),

  ACCESS_TOKEN_TTL: z.coerce.number().default(900),

  REFRESH_TOKEN_TTL: z.coerce.number().default(604800),

  CLOUDINARY_CLOUD_NAME: z.string().default(""),

  CLOUDINARY_API_KEY: z.string().default(""),

  CLOUDINARY_API_SECRET: z.string().default(""),
});

export const env = envSchema.parse(process.env);
