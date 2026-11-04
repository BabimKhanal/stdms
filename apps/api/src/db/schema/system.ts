import { relations } from "drizzle-orm";
import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { createdAtCol, idCol, orgIdCol, updatedAtCol } from "./tenant";
import { organisations, users } from "./tenant";

/**
 * File metadata only — the bytes live in object storage (S3/R2).
 * `key` is the storage pointer; `url` is the signed/public URL.
 */
export const files = pgTable(
  "files",
  {
    id: idCol(),
    organisationId: orgIdCol(),
    key: text("key").notNull(),
    filename: text("filename").notNull(),
    mimeType: text("mime_type"),
    size: bigint("size", { mode: "number" }),
    url: text("url"),
    uploadedBy: uuid("uploaded_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: createdAtCol(),
  },
  (t) => [uniqueIndex("files_org_key_uq").on(t.organisationId, t.key)],
);

/** Global execution history for encrypted full-database backups. */
export const backupJobs = pgTable(
  "backup_jobs",
  {
    id: idCol(),
    status: text("status").notNull(),
    provider: text("provider").notNull(),
    objectKey: text("object_key"),
    sizeBytes: bigint("size_bytes", { mode: "number" }),
    sha256: text("sha256"),
    error: text("error"),
    startedAt: timestamp("started_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    createdAt: createdAtCol(),
  },
  (table) => [index("backup_jobs_started_at_idx").on(table.startedAt)],
);

export const documentTemplates = pgTable(
  "document_templates",
  {
    id: idCol(),
    organisationId: orgIdCol(),
    name: text("name").notNull(),
    documentType: text("document_type").notNull(),
    design: jsonb("design").$type<Record<string, unknown>>().notNull(),
    isDefault: integer("is_default").notNull().default(0),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: createdAtCol(),
    updatedAt: updatedAtCol(),
  },
  (t) => [
    uniqueIndex("document_templates_org_name_uq").on(t.organisationId, t.name),
    index("document_templates_org_type_idx").on(
      t.organisationId,
      t.documentType,
    ),
  ],
);

/** Tenant-owned outbound email identity and delivery preferences. */
export const emailSettings = pgTable(
  "email_settings",
  {
    id: idCol(),
    organisationId: orgIdCol(),
    provider: text("provider").notNull().default("resend"),
    enabled: boolean("enabled").notNull().default(true),
    fromName: text("from_name").notNull(),
    fromEmail: text("from_email").notNull(),
    replyTo: text("reply_to"),
    footer: text("footer"),
    dailyLimit: integer("daily_limit").notNull().default(1000),
    providerDomain: text("provider_domain"),
    smtpHost: text("smtp_host"),
    smtpPort: integer("smtp_port"),
    smtpSecure: boolean("smtp_secure").notNull().default(false),
    smtpUsername: text("smtp_username"),
    credentialsEncrypted: text("credentials_encrypted"),
    lastTestedAt: timestamp("last_tested_at", { withTimezone: true }),
    lastTestError: text("last_test_error"),
    createdAt: createdAtCol(),
    updatedAt: updatedAtCol(),
  },
  (t) => [uniqueIndex("email_settings_org_uq").on(t.organisationId)],
);

/** Global outbound email identity used by platform alerts. */
export const platformEmailSettings = pgTable(
  "platform_email_settings",
  {
    id: idCol(),
    singleton: text("singleton").notNull().default("default"),
    provider: text("provider").notNull().default("console"),
    enabled: boolean("enabled").notNull().default(true),
    fromName: text("from_name").notNull(),
    fromEmail: text("from_email").notNull(),
    replyTo: text("reply_to"),
    footer: text("footer"),
    providerDomain: text("provider_domain"),
    smtpHost: text("smtp_host"),
    smtpPort: integer("smtp_port"),
    smtpSecure: boolean("smtp_secure").notNull().default(false),
    smtpUsername: text("smtp_username"),
    credentialsEncrypted: text("credentials_encrypted"),
    createdAt: createdAtCol(),
    updatedAt: updatedAtCol(),
  },
  (table) => [uniqueIndex("platform_email_settings_singleton_uq").on(table.singleton)],
);

/** Tenant-configurable transactional and broadcast email templates. */
export const emailTemplates = pgTable(
  "email_templates",
  {
    id: idCol(),
    organisationId: orgIdCol(),
    key: text("key").notNull(),
    name: text("name").notNull(),
    subject: text("subject").notNull(),
    htmlBody: text("html_body").notNull(),
    textBody: text("text_body"),
    isActive: boolean("is_active").notNull().default(true),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: createdAtCol(),
    updatedAt: updatedAtCol(),
  },
  (t) => [
    uniqueIndex("email_templates_org_key_uq").on(t.organisationId, t.key),
    index("email_templates_org_idx").on(t.organisationId),
  ],
);

/** Immutable per-recipient email delivery history for support and retry. */
export const emailDeliveries = pgTable(
  "email_deliveries",
  {
    id: idCol(),
    organisationId: orgIdCol(),
    templateKey: text("template_key"),
    toEmail: text("to_email").notNull(),
    subject: text("subject").notNull(),
    htmlBody: text("html_body"),
    provider: text("provider").notNull(),
    status: text("status").notNull().default("queued"),
    error: text("error"),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdAt: createdAtCol(),
  },
  (t) => [
    index("email_deliveries_org_created_idx").on(t.organisationId, t.createdAt),
    index("email_deliveries_status_idx").on(t.organisationId, t.status),
  ],
);

/** Central notification feed (SRS §52) — channels (push/email/SMS) fan out from here. */
export const notifications = pgTable(
  "notifications",
  {
    id: idCol(),
    organisationId: orgIdCol(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    data: jsonb("data").$type<Record<string, unknown>>(),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: createdAtCol(),
  },
  (t) => [index("notifications_user_idx").on(t.userId, t.createdAt)],
);

export const pushTokens = pgTable(
  "push_tokens",
  {
    id: idCol(),
    organisationId: orgIdCol(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull(),
    platform: text("platform").notNull().default("unknown"),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    createdAt: createdAtCol(),
  },
  (t) => [uniqueIndex("push_tokens_uq").on(t.token)],
);

/* ------------------------------ Relations ------------------------------ */

export const notificationsRelations = relations(notifications, ({ one }) => ({
  organisation: one(organisations, {
    fields: [notifications.organisationId],
    references: [organisations.id],
  }),
  user: one(users, { fields: [notifications.userId], references: [users.id] }),
}));

export const pushTokensRelations = relations(pushTokens, ({ one }) => ({
  user: one(users, { fields: [pushTokens.userId], references: [users.id] }),
}));
