import { relations } from "drizzle-orm";
import { date, index, integer, numeric, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import {
  createdAtCol,
  feeFrequencyEnum,
  idCol,
  invoiceStatusEnum,
  orgIdCol,
  paymentMethodEnum,
  paymentSubmissionStatusEnum,
  updatedAtCol,
} from "./tenant";
import { organisations, users } from "./tenant";
import { students } from "./people";
import { classes } from "./academics";

export const feeCategories = pgTable(
  "fee_categories",
  {
    id: idCol(),
    organisationId: orgIdCol(),
    name: text("name").notNull(),
    description: text("description"),
    createdAt: createdAtCol(),
  },
  (t) => [uniqueIndex("fee_categories_org_name_uq").on(t.organisationId, t.name)],
);

export const feeStructures = pgTable(
  "fee_structures",
  {
    id: idCol(),
    organisationId: orgIdCol(),
    name: text("name").notNull(),
    academicYearId: uuid("academic_year_id").notNull(),
    classId: uuid("class_id")
      .notNull()
      .references(() => classes.id, { onDelete: "cascade" }),
    createdAt: createdAtCol(),
  },
  (t) => [uniqueIndex("fee_structures_org_name_uq").on(t.organisationId, t.name)],
);

export const feeStructureItems = pgTable(
  "fee_structure_items",
  {
    id: idCol(),
    organisationId: orgIdCol(),
    feeStructureId: uuid("fee_structure_id")
      .notNull()
      .references(() => feeStructures.id, { onDelete: "cascade" }),
    feeCategoryId: uuid("fee_category_id").references(() => feeCategories.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    frequency: feeFrequencyEnum("frequency").notNull().default("monthly"),
    createdAt: createdAtCol(),
  },
  (t) => [index("fee_structure_items_structure_idx").on(t.feeStructureId)],
);

export const invoices = pgTable(
  "invoices",
  {
    id: idCol(),
    organisationId: orgIdCol(),
    invoiceNumber: text("invoice_number").notNull(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    issueDate: date("issue_date").notNull(),
    dueDate: date("due_date"),
    status: invoiceStatusEnum("status").notNull().default("unpaid"),
    subtotal: numeric("subtotal", { precision: 12, scale: 2 }).notNull().default("0"),
    discount: numeric("discount", { precision: 12, scale: 2 }).notNull().default("0"),
    fine: numeric("fine", { precision: 12, scale: 2 }).notNull().default("0"),
    total: numeric("total", { precision: 12, scale: 2 }).notNull().default("0"),
    paid: numeric("paid", { precision: 12, scale: 2 }).notNull().default("0"),
    notes: text("notes"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAtCol(),
    updatedAt: updatedAtCol(),
  },
  (t) => [
    uniqueIndex("invoices_org_number_uq").on(t.organisationId, t.invoiceNumber),
    index("invoices_student_idx").on(t.studentId),
    index("invoices_org_status_idx").on(t.organisationId, t.status),
  ],
);

export const invoiceItems = pgTable(
  "invoice_items",
  {
    id: idCol(),
    organisationId: orgIdCol(),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    dueDate: date("due_date"),
    createdAt: createdAtCol(),
  },
  (t) => [index("invoice_items_invoice_idx").on(t.invoiceId)],
);

export const payments = pgTable(
  "payments",
  {
    id: idCol(),
    organisationId: orgIdCol(),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    method: paymentMethodEnum("method").notNull().default("cash"),
    reference: text("reference"),
    gatewayRef: text("gateway_ref"),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    paidAt: timestamp("paid_at", { withTimezone: true }).defaultNow().notNull(),
    receivedBy: uuid("received_by").references(() => users.id, { onDelete: "set null" }),
    notes: text("notes"),
    createdAt: createdAtCol(),
  },
  (t) => [index("payments_invoice_idx").on(t.invoiceId), uniqueIndex("payments_gateway_ref_uq").on(t.gatewayRef)],
);

export const refunds = pgTable(
  "refunds",
  {
    id: idCol(),
    organisationId: orgIdCol(),
    paymentId: uuid("payment_id").notNull().references(() => payments.id, { onDelete: "restrict" }),
    invoiceId: uuid("invoice_id").notNull().references(() => invoices.id, { onDelete: "restrict" }),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    reason: text("reason"),
    refundedBy: uuid("refunded_by").references(() => users.id, { onDelete: "set null" }),
    refundedAt: timestamp("refunded_at", { withTimezone: true }).defaultNow().notNull(),
    createdAt: createdAtCol(),
  },
  (t) => [index("refunds_invoice_idx").on(t.invoiceId), index("refunds_payment_idx").on(t.paymentId)],
);

export const paymentMethods = pgTable(
  "payment_methods",
  {
    id: idCol(),
    organisationId: orgIdCol(),
    method: paymentMethodEnum("method").notNull(),
    label: text("label").notNull(),
    enabled: integer("enabled").notNull().default(1),
    instructions: text("instructions"),
    bankName: text("bank_name"),
    accountName: text("account_name"),
    accountNumber: text("account_number"),
    branch: text("branch"),
    qrImageUrl: text("qr_image_url"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: createdAtCol(),
    updatedAt: updatedAtCol(),
  },
  (t) => [index("payment_methods_org_idx").on(t.organisationId)],
);

/** Tenant-owned gateway credentials. Secret fields are never returned by API routes. */
export const paymentGatewaySettings = pgTable(
  "payment_gateway_settings",
  {
    id: idCol(),
    organisationId: orgIdCol(),
    provider: text("provider").notNull(),
    enabled: integer("enabled").notNull().default(0),
    merchantCode: text("merchant_code"),
    secretKey: text("secret_key"),
    publicKey: text("public_key"),
    apiUrl: text("api_url"),
    successUrl: text("success_url"),
    failureUrl: text("failure_url"),
    createdAt: createdAtCol(),
    updatedAt: updatedAtCol(),
  },
  (t) => [uniqueIndex("payment_gateway_settings_org_provider_uq").on(t.organisationId, t.provider)],
);

export const feeAccessSettings = pgTable(
  "fee_access_settings",
  {
    id: idCol(),
    organisationId: orgIdCol(),
    studentVisible: integer("student_visible").notNull().default(1),
    studentOnlinePayment: integer("student_online_payment").notNull().default(0),
    guardianVisible: integer("guardian_visible").notNull().default(1),
    showDiscounts: integer("show_discounts").notNull().default(1),
    dueReminders: integer("due_reminders").notNull().default(1),
    createdAt: createdAtCol(),
    updatedAt: updatedAtCol(),
  },
  (t) => [uniqueIndex("fee_access_settings_org_uq").on(t.organisationId)],
);

export const paymentSubmissions = pgTable(
  "payment_submissions",
  {
    id: idCol(),
    organisationId: orgIdCol(),
    invoiceId: uuid("invoice_id").notNull().references(() => invoices.id, { onDelete: "cascade" }),
    paymentMethodId: uuid("payment_method_id").notNull().references(() => paymentMethods.id, { onDelete: "restrict" }),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    reference: text("reference"),
    proofUrl: text("proof_url"),
    status: paymentSubmissionStatusEnum("status").notNull().default("pending"),
    submittedBy: uuid("submitted_by").notNull().references(() => users.id, { onDelete: "restrict" }),
    reviewedBy: uuid("reviewed_by").references(() => users.id, { onDelete: "set null" }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewNote: text("review_note"),
    createdAt: createdAtCol(),
    updatedAt: updatedAtCol(),
  },
  (t) => [index("payment_submissions_org_status_idx").on(t.organisationId, t.status), index("payment_submissions_invoice_idx").on(t.invoiceId)],
);

/** Discounts / scholarships applied to an invoice (history rows). */
export const discounts = pgTable(
  "discounts",
  {
    id: idCol(),
    organisationId: orgIdCol(),
    invoiceId: uuid("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    reason: text("reason"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAtCol(),
  },
  (t) => [index("discounts_invoice_idx").on(t.invoiceId)],
);

/* ------------------------------ Relations ------------------------------ */

export const feeStructuresRelations = relations(feeStructures, ({ one, many }) => ({
  organisation: one(organisations, {
    fields: [feeStructures.organisationId],
    references: [organisations.id],
  }),
  items: many(feeStructureItems),
  class: one(classes, { fields: [feeStructures.classId], references: [classes.id] }),
}));

export const feeStructureItemsRelations = relations(feeStructureItems, ({ one }) => ({
  feeStructure: one(feeStructures, {
    fields: [feeStructureItems.feeStructureId],
    references: [feeStructures.id],
  }),
  feeCategory: one(feeCategories, {
    fields: [feeStructureItems.feeCategoryId],
    references: [feeCategories.id],
  }),
}));

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  student: one(students, { fields: [invoices.studentId], references: [students.id] }),
  items: many(invoiceItems),
  payments: many(payments),
  discounts: many(discounts),
}));

export const invoiceItemsRelations = relations(invoiceItems, ({ one }) => ({
  invoice: one(invoices, { fields: [invoiceItems.invoiceId], references: [invoices.id] }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  invoice: one(invoices, { fields: [payments.invoiceId], references: [invoices.id] }),
  receiver: one(users, { fields: [payments.receivedBy], references: [users.id] }),
}));

export const refundsRelations = relations(refunds, ({ one }) => ({
  payment: one(payments, { fields: [refunds.paymentId], references: [payments.id] }),
  invoice: one(invoices, { fields: [refunds.invoiceId], references: [invoices.id] }),
  refunder: one(users, { fields: [refunds.refundedBy], references: [users.id] }),
}));

export const discountsRelations = relations(discounts, ({ one }) => ({
  invoice: one(invoices, { fields: [discounts.invoiceId], references: [invoices.id] }),
}));
