import { z } from "zod";
import { dateSchema, idSchema } from "./common";
import { FEE_FREQUENCIES, INVOICE_STATUSES, PAYMENT_METHODS } from "../constants";

export const feeCategorySchema = z.object({
  id: idSchema,
  name: z.string(),
  description: z.string().nullable(),
});
export type FeeCategory = z.infer<typeof feeCategorySchema>;

export const feeCategoryInputSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(200).nullable().optional(),
});

export const feeStructureItemSchema = z.object({
  id: idSchema,
  feeStructureId: idSchema,
  feeCategoryId: idSchema,
  feeCategoryName: z.string().optional(),
  name: z.string(),
  amount: z.number(),
  frequency: z.enum(FEE_FREQUENCIES),
});
export type FeeStructureItem = z.infer<typeof feeStructureItemSchema>;

export const feeStructureSchema = z.object({
  id: idSchema,
  name: z.string(),
  academicYearId: z.uuid(),
  classId: z.uuid(),
  className: z.string().optional(),
  items: z.array(feeStructureItemSchema),
  totalAmount: z.number().optional(),
});
export type FeeStructure = z.infer<typeof feeStructureSchema>;

export const feeStructureInputSchema = z.object({
  name: z.string().trim().min(2).max(100),
  academicYearId: idSchema,
  classId: idSchema,
  items: z
    .array(
      z.object({
        feeCategoryId: idSchema,
        name: z.string().trim().min(1).max(80),
        amount: z.number().min(0),
        frequency: z.enum(FEE_FREQUENCIES).default("monthly"),
      }),
    )
    .min(1),
});
export type FeeStructureInput = z.infer<typeof feeStructureInputSchema>;

export const invoiceItemSchema = z.object({
  id: idSchema,
  name: z.string(),
  amount: z.number(),
  dueDate: dateSchema.nullable(),
});
export type InvoiceItem = z.infer<typeof invoiceItemSchema>;

export const invoiceSchema = z.object({
  id: idSchema,
  invoiceNumber: z.string(),
  studentId: idSchema,
  studentName: z.string().optional(),
  className: z.string().nullable().optional(),
  issueDate: dateSchema,
  dueDate: dateSchema.nullable(),
  status: z.enum(INVOICE_STATUSES),
  subtotal: z.number(),
  discount: z.number(),
  fine: z.number(),
  total: z.number(),
  paid: z.number(),
  balance: z.number(),
  items: z.array(invoiceItemSchema).optional(),
  payments: z.array(z.any()).optional(),
});
export type Invoice = z.infer<typeof invoiceSchema>;

export const invoiceInputSchema = z.object({
  studentId: idSchema,
  issueDate: dateSchema,
  dueDate: dateSchema.nullable().optional(),
  items: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(100),
        amount: z.number().min(0),
        dueDate: dateSchema.nullable().optional(),
      }),
    )
    .min(1),
  discount: z.number().min(0).default(0),
  fine: z.number().min(0).default(0),
});

/** Bulk-generate invoices for a class from a fee structure. */
export const generateInvoicesSchema = z.object({
  feeStructureId: idSchema,
  dueDate: dateSchema,
  /** Restrict to one section (optional). */
  sectionId: z.uuid().optional(),
});
export type GenerateInvoicesInput = z.infer<typeof generateInvoicesSchema>;

export const paymentSchema = z.object({
  id: idSchema,
  invoiceId: idSchema,
  invoiceNumber: z.string().optional(),
  studentId: z.uuid().nullable(),
  studentName: z.string().optional(),
  amount: z.number(),
  method: z.enum(PAYMENT_METHODS),
  reference: z.string().nullable(),
  gatewayRef: z.string().nullable().optional(),
  verifiedAt: z.string().nullable().optional(),
  paidAt: z.string(),
  receivedBy: z.uuid().nullable(),
  notes: z.string().nullable(),
});
export type Payment = z.infer<typeof paymentSchema>;

export const paymentInputSchema = z.object({
  invoiceId: idSchema,
  amount: z.number().min(0.01),
  method: z.enum(PAYMENT_METHODS),
  reference: z.string().trim().max(80).nullable().optional(),
  paidAt: z.string().optional(),
  notes: z.string().trim().max(300).nullable().optional(),
});
export type PaymentInput = z.infer<typeof paymentInputSchema>;

export const paymentInitiateSchema = z.object({
  invoiceId: idSchema,
});

export const paymentMethodInputSchema = z.object({
  method: z.enum(PAYMENT_METHODS),
  label: z.string().trim().min(1).max(80),
  enabled: z.boolean().default(true),
  instructions: z.string().trim().max(1000).nullable().optional(),
  bankName: z.string().trim().max(120).nullable().optional(),
  accountName: z.string().trim().max(120).nullable().optional(),
  accountNumber: z.string().trim().max(80).nullable().optional(),
  branch: z.string().trim().max(120).nullable().optional(),
  qrImageUrl: z.string().url().nullable().optional(),
  sortOrder: z.number().int().min(0).max(1000).default(0),
});

export const manualPaymentSubmissionSchema = z.object({
  invoiceId: idSchema,
  paymentMethodId: idSchema,
  amount: z.number().positive(),
  reference: z.string().trim().max(120).nullable().optional(),
  proofUrl: z.string().url().nullable().optional(),
});
export type ManualPaymentSubmissionInput = z.infer<typeof manualPaymentSubmissionSchema>;

export const paymentSubmissionReviewSchema = z.object({
  status: z.enum(["approved", "rejected"]),
  reviewNote: z.string().trim().max(500).nullable().optional(),
});

export const studentFeeProfileSchema = z.object({
  studentId: idSchema,
  studentName: z.string(),
  className: z.string().nullable(),
  total: z.number(),
  paid: z.number(),
  discount: z.number(),
  outstanding: z.number(),
  invoices: z.array(invoiceSchema),
});
export type StudentFeeProfile = z.infer<typeof studentFeeProfileSchema>;
