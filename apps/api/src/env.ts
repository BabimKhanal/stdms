import dotenv from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

dotenv.config({
  path: resolve(dirname(fileURLToPath(import.meta.url)), "../.env"),
});

const envSchema = z
  .object({
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

    MAILER_PROVIDER: z
      .enum(["console", "resend", "sendgrid", "mailgun", "smtp"])
      .default("console"),
    RESEND_API_KEY: z.string().default(""),
    SENDGRID_API_KEY: z.string().default(""),
    MAILGUN_API_KEY: z.string().default(""),
    MAILGUN_DOMAIN: z.string().default(""),
    EMAIL_CREDENTIALS_ENCRYPTION_KEY: z.string().default(""),
    MAIL_FROM: z.string().default("Nucleus <no-reply@example.com>"),
    MAIL_FROM_EMAIL: z.string().default("no-reply@example.com"),
    SMS_PROVIDER: z.enum(["console", "webhook"]).default("console"),
    SMS_WEBHOOK_URL: z.string().default(""),
    PUSH_PROVIDER: z.enum(["console", "webhook", "expo"]).default("console"),
    PUSH_WEBHOOK_URL: z.string().default(""),
    EXPO_ACCESS_TOKEN: z.string().default(""),
    PASSWORD_RESET_URL: z
      .string()
      .default("http://localhost:3000/reset-password"),
    ESEWA_ENABLED: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
    ESEWA_MERCHANT_CODE: z.string().default("EPAYTEST"),
    ESEWA_SECRET_KEY: z.string().default(""),
    ESEWA_FORM_URL: z
      .string()
      .default("https://rc-epay.esewa.com.np/api/epay/main/v2/form"),
    PAYMENT_CALLBACK_URL: z
      .string()
      .default("http://localhost:4000/api/v1/payments/esewa"),
    BACKUP_SCHEDULE: z.string().default("0 2 * * *"),
    BACKUP_RETENTION_DAILY: z.coerce.number().int().min(1).max(365).default(35),
    BACKUP_RETENTION_MONTHLY: z.coerce
      .number()
      .int()
      .min(1)
      .max(60)
      .default(12),
  })
  .superRefine((value, context) => {
    if (value.NODE_ENV !== "production") return;
    const secretFields = [
      ["JWT_ACCESS_SECRET", value.JWT_ACCESS_SECRET],
      ["JWT_REFRESH_SECRET", value.JWT_REFRESH_SECRET],
    ] as const;
    for (const [field, secret] of secretFields) {
      if (secret.length < 32 || /change-me|secret/i.test(secret))
        context.addIssue({
          code: "custom",
          path: [field],
          message:
            "Use a unique random production secret of at least 32 characters",
        });
    }
    if (value.MAILER_PROVIDER === "console")
      context.addIssue({
        code: "custom",
        path: ["MAILER_PROVIDER"],
        message: "Console mail is not allowed in production",
      });
    if (value.MAILER_PROVIDER === "resend" && !value.RESEND_API_KEY)
      context.addIssue({
        code: "custom",
        path: ["RESEND_API_KEY"],
        message: "Required for Resend",
      });
    if (value.MAILER_PROVIDER === "sendgrid" && !value.SENDGRID_API_KEY)
      context.addIssue({
        code: "custom",
        path: ["SENDGRID_API_KEY"],
        message: "Required for SendGrid",
      });
    if (
      value.MAILER_PROVIDER === "mailgun" &&
      (!value.MAILGUN_API_KEY || !value.MAILGUN_DOMAIN)
    )
      context.addIssue({
        code: "custom",
        path: ["MAILGUN_API_KEY"],
        message: "Mailgun API key and domain are required",
      });
    if (value.EMAIL_CREDENTIALS_ENCRYPTION_KEY.length < 32)
      context.addIssue({
        code: "custom",
        path: ["EMAIL_CREDENTIALS_ENCRYPTION_KEY"],
        message: "Use a random encryption key of at least 32 characters",
      });
    if (!value.PASSWORD_RESET_URL.startsWith("https://"))
      context.addIssue({
        code: "custom",
        path: ["PASSWORD_RESET_URL"],
        message: "Production password reset URL must use HTTPS",
      });
    if (value.ESEWA_ENABLED) {
      if (
        !value.ESEWA_MERCHANT_CODE ||
        value.ESEWA_MERCHANT_CODE === "EPAYTEST"
      )
        context.addIssue({
          code: "custom",
          path: ["ESEWA_MERCHANT_CODE"],
          message: "Configure the production merchant code",
        });
      if (value.ESEWA_SECRET_KEY.length < 12)
        context.addIssue({
          code: "custom",
          path: ["ESEWA_SECRET_KEY"],
          message: "Configure the production eSewa secret",
        });
      if (!value.PAYMENT_CALLBACK_URL.startsWith("https://"))
        context.addIssue({
          code: "custom",
          path: ["PAYMENT_CALLBACK_URL"],
          message: "Production payment callback must use HTTPS",
        });
    }
  });

export const env = envSchema.parse(process.env);
