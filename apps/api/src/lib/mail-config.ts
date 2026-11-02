import { decryptEmailCredential } from "./email-credentials";
import type { MailConfig, MailProvider } from "./mailer";

export type EmailSettingsRow = {
  provider: string;
  enabled: boolean;
  fromName: string;
  fromEmail: string;
  replyTo: string | null;
  footer: string | null;
  providerDomain?: string | null;
  smtpHost?: string | null;
  smtpPort?: number | null;
  smtpSecure?: boolean;
  smtpUsername?: string | null;
  credentialsEncrypted?: string | null;
};

type StoredCredentials = { apiKey?: string; smtpPassword?: string };

export function readEmailCredentials(value: string | null | undefined): StoredCredentials {
  if (!value) return {};
  try {
    return JSON.parse(decryptEmailCredential(value)) as StoredCredentials;
  } catch {
    return {};
  }
}

export function buildMailConfig(settings: EmailSettingsRow): MailConfig {
  const credentials = readEmailCredentials(settings.credentialsEncrypted);
  return {
    provider: settings.provider as MailProvider,
    enabled: settings.enabled,
    fromName: settings.fromName,
    fromEmail: settings.fromEmail,
    replyTo: settings.replyTo,
    footer: settings.footer,
    providerDomain: settings.providerDomain ?? null,
    apiKey: credentials.apiKey,
    smtp: {
      host: settings.smtpHost ?? null,
      port: settings.smtpPort ?? null,
      secure: settings.smtpSecure ?? true,
      username: settings.smtpUsername ?? null,
      password: credentials.smtpPassword,
    },
  };
}
