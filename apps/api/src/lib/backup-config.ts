import dotenv from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

dotenv.config({
  path: resolve(dirname(fileURLToPath(import.meta.url)), "../../.env"),
});

export const backupConfig = z
  .object({
    BACKUP_DATABASE_URL: z.string().default(""),
    BACKUP_S3_ENDPOINT: z.string().default(""),
    BACKUP_S3_REGION: z.string().default("auto"),
    BACKUP_S3_BUCKET: z.string().default(""),
    BACKUP_S3_ACCESS_KEY_ID: z.string().default(""),
    BACKUP_S3_SECRET_ACCESS_KEY: z.string().default(""),
    BACKUP_ENCRYPTION_KEY: z.string().default(""),
    BACKUP_ALERT_WEBHOOK_URL: z.string().default(""),
    BACKUP_RETENTION_DAILY: z.coerce.number().int().min(1).max(365).default(35),
    BACKUP_RETENTION_MONTHLY: z.coerce
      .number()
      .int()
      .min(1)
      .max(60)
      .default(12),
  })
  .parse(process.env);
