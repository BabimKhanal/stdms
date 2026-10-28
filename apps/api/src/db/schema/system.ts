import { relations } from "drizzle-orm";
import { bigint, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { createdAtCol, idCol, orgIdCol } from "./tenant";
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
    uploadedBy: uuid("uploaded_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAtCol(),
  },
  (t) => [uniqueIndex("files_org_key_uq").on(t.organisationId, t.key)],
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
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAtCol(),
    updatedAt: createdAtCol(),
  },
  (t) => [uniqueIndex("document_templates_org_name_uq").on(t.organisationId, t.name), index("document_templates_org_type_idx").on(t.organisationId, t.documentType)],
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
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).defaultNow().notNull(),
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
