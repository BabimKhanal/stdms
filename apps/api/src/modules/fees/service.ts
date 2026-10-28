import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import type { DB } from "../../lib/types";
import { feeCategories, feeStructures, feeStructureItems, invoices, invoiceItems, payments, students, classes, enrolments, sections, organisations } from "../../db/schema";
import type { FeeStructureInput, PaymentInput, GenerateInvoicesInput } from "@edu/shared";
import { z } from "zod";
import { feeCategoryInputSchema, invoiceInputSchema } from "@edu/shared";
type FeeCategoryInput = z.infer<typeof feeCategoryInputSchema>;
type InvoiceInput = z.infer<typeof invoiceInputSchema>;
import { conflict, notFound } from "../../lib/errors";
import type { AuthUser } from "../../lib/context";
import { learnerStudentIds } from "../../lib/teacher-scope";
const tenant = (table: { organisationId: any }, orgId: string) => eq(table.organisationId, orgId);

export async function listCategories(db: DB, orgId: string) { return db.select().from(feeCategories).where(tenant(feeCategories, orgId)).orderBy(asc(feeCategories.name)); }
export async function createCategory(db: DB, orgId: string, input: FeeCategoryInput) { try { const [row] = await db.insert(feeCategories).values({ ...input, organisationId: orgId }).returning(); return row; } catch (e) { if ((e as any).code === "23505") throw conflict("Fee category already exists"); throw e; } }
export async function updateCategory(db: DB, orgId: string, id: string, input: Partial<FeeCategoryInput>) { const [row] = await db.update(feeCategories).set(input).where(and(eq(feeCategories.id, id), tenant(feeCategories, orgId))).returning(); if (!row) throw notFound("Fee category not found"); return row; }
export async function deleteCategory(db: DB, orgId: string, id: string) { const rows = await db.delete(feeCategories).where(and(eq(feeCategories.id, id), tenant(feeCategories, orgId))).returning(); if (!rows.length) throw notFound("Fee category not found"); }
export async function listStructures(db: DB, orgId: string) { const rows = await db.select({ structure: feeStructures, className: classes.name }).from(feeStructures).innerJoin(classes, eq(feeStructures.classId, classes.id)).where(tenant(feeStructures, orgId)).orderBy(asc(feeStructures.name)); const items = await db.select().from(feeStructureItems).where(tenant(feeStructureItems, orgId)); return rows.map(({ structure, className }) => ({ ...structure, className, items: items.filter((i) => i.feeStructureId === structure.id), totalAmount: items.filter((i) => i.feeStructureId === structure.id).reduce((n, i) => n + Number(i.amount), 0) })); }
export async function createStructure(db: DB, orgId: string, input: FeeStructureInput) { return db.transaction(async (tx) => { const [structure] = await tx.insert(feeStructures).values({ organisationId: orgId, name: input.name, academicYearId: input.academicYearId, classId: input.classId }).returning(); await tx.insert(feeStructureItems).values(input.items.map((item) => ({ ...item, organisationId: orgId, feeStructureId: structure.id, amount: String(item.amount) }))); return structure; }); }
export async function updateStructure(db: DB, orgId: string, id: string, input: Partial<FeeStructureInput>) { return db.transaction(async (tx) => { const [row] = await tx.update(feeStructures).set({ name: input.name, academicYearId: input.academicYearId, classId: input.classId }).where(and(eq(feeStructures.id, id), tenant(feeStructures, orgId))).returning(); if (!row) throw notFound("Fee structure not found"); if (input.items) { await tx.delete(feeStructureItems).where(and(eq(feeStructureItems.feeStructureId, id), tenant(feeStructureItems, orgId))); await tx.insert(feeStructureItems).values(input.items.map((item) => ({ ...item, organisationId: orgId, feeStructureId: id, amount: String(item.amount) }))); } return row; }); }
export async function deleteStructure(db: DB, orgId: string, id: string) { const rows = await db.delete(feeStructures).where(and(eq(feeStructures.id, id), tenant(feeStructures, orgId))).returning(); if (!rows.length) throw notFound("Fee structure not found"); }
export async function listInvoices(db: DB, orgId: string, principal?: AuthUser) { const learnerIds = principal ? await learnerStudentIds(db, orgId, principal) : null; const conditions = [tenant(invoices, orgId)]; if (learnerIds) conditions.push(learnerIds.length ? inArray(invoices.studentId, learnerIds) : sql`false`); return db.select({ ...(invoices as any), studentName: sql<string>`concat(${students.firstName}, ' ', ${students.lastName})`, balance: sql<number>`${invoices.total} - ${invoices.paid}` }).from(invoices).innerJoin(students, eq(invoices.studentId, students.id)).where(and(...conditions)).orderBy(desc(invoices.issueDate)); }
export async function getInvoice(db: DB, orgId: string, id: string, principal?: AuthUser) { const [invoice] = await db.select().from(invoices).where(and(eq(invoices.id, id), tenant(invoices, orgId))); if (!invoice) throw notFound("Invoice not found"); const learnerIds = principal ? await learnerStudentIds(db, orgId, principal) : null; if (learnerIds && !learnerIds.includes(invoice.studentId)) throw notFound("Invoice not found"); const items = await db.select().from(invoiceItems).where(and(eq(invoiceItems.invoiceId, id), tenant(invoiceItems, orgId))); const paid = await db.select().from(payments).where(and(eq(payments.invoiceId, id), tenant(payments, orgId))); return { ...invoice, items, payments: paid, balance: Number(invoice.total) - Number(invoice.paid) }; }
export async function createInvoice(db: DB, orgId: string, userId: string, input: InvoiceInput) { return db.transaction(async (tx) => { const subtotal = input.items.reduce((n, i) => n + i.amount, 0); const total = subtotal - input.discount + input.fine; const [invoice] = await tx.insert(invoices).values({ organisationId: orgId, invoiceNumber: `INV-${Date.now()}`, studentId: input.studentId, issueDate: input.issueDate, dueDate: input.dueDate ?? null, subtotal: String(subtotal), discount: String(input.discount), fine: String(input.fine), total: String(total), createdBy: userId }).returning(); await tx.insert(invoiceItems).values(input.items.map((i) => ({ ...i, invoiceId: invoice.id, organisationId: orgId, amount: String(i.amount), dueDate: i.dueDate ?? null }))); return invoice; }); }

export async function generateInvoices(db: DB, orgId: string, userId: string, input: GenerateInvoicesInput) {
  return db.transaction(async (tx) => {
    const [structure] = await tx.select().from(feeStructures).where(and(eq(feeStructures.id, input.feeStructureId), tenant(feeStructures, orgId))).limit(1);
    if (!structure) throw notFound("Fee structure not found");
    const items = await tx.select().from(feeStructureItems).where(and(eq(feeStructureItems.feeStructureId, structure.id), tenant(feeStructureItems, orgId)));
    if (!items.length) throw conflict("Fee structure has no items");

    const enrolmentConditions = [
      tenant(enrolments, orgId),
      eq(enrolments.academicYearId, structure.academicYearId),
      eq(enrolments.classId, structure.classId),
    ];
    if (input.sectionId) enrolmentConditions.push(eq(enrolments.sectionId, input.sectionId));
    const enrolled = await tx.select({ studentId: enrolments.studentId }).from(enrolments).where(and(...enrolmentConditions));
    if (!enrolled.length) return { created: 0, skipped: 0, invoiceIds: [] as string[] };

    const marker = `fee-structure:${structure.id}:due:${input.dueDate}`;
    const existing = await tx.select({ studentId: invoices.studentId }).from(invoices).where(and(tenant(invoices, orgId), eq(invoices.notes, marker), inArray(invoices.studentId, enrolled.map((row) => row.studentId))));
    const existingStudents = new Set(existing.map((row) => row.studentId));
    const toCreate = enrolled.filter((row) => !existingStudents.has(row.studentId));
    const invoiceIds: string[] = [];
    for (let index = 0; index < toCreate.length; index += 1) {
      const subtotal = items.reduce((total, item) => total + Number(item.amount), 0);
      const [invoice] = await tx.insert(invoices).values({
        organisationId: orgId,
        invoiceNumber: `INV-${Date.now()}-${index + 1}`,
        studentId: toCreate[index].studentId,
        issueDate: new Date().toISOString().slice(0, 10),
        dueDate: input.dueDate,
        subtotal: String(subtotal),
        total: String(subtotal),
        notes: marker,
        createdBy: userId,
      }).returning({ id: invoices.id });
      await tx.insert(invoiceItems).values(items.map((item) => ({
        organisationId: orgId,
        invoiceId: invoice.id,
        name: item.name,
        amount: item.amount,
        dueDate: input.dueDate,
      })));
      invoiceIds.push(invoice.id);
    }
    return { created: toCreate.length, skipped: existingStudents.size, invoiceIds };
  });
}

function escapeHtml(value: unknown) {
  return String(value ?? "").replace(/[&<>\"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[character] ?? character);
}

export async function receiptContext(db: DB, orgId: string, invoiceId: string, principal?: AuthUser) {
  const invoice = await getInvoice(db, orgId, invoiceId, principal);
  const [student] = await db.select({ fullName: sql<string>`concat(${students.firstName}, ' ', ${students.lastName})`, studentId: students.studentId, className: classes.name }).from(students).leftJoin(enrolments, and(eq(enrolments.studentId, students.id), tenant(enrolments, orgId))).leftJoin(classes, eq(enrolments.classId, classes.id)).where(and(eq(students.id, invoice.studentId), tenant(students, orgId))).limit(1);
  const [organisation] = await db.select({ name: organisations.name, address: organisations.address, phone: organisations.phone, email: organisations.email }).from(organisations).where(eq(organisations.id, orgId)).limit(1);
  return { invoice, student: student ?? null, organisation: organisation ?? null };
}

export function buildReceiptHtml(context: Awaited<ReturnType<typeof receiptContext>>) {
  const { invoice, student, organisation } = context;
  const rows = (invoice.items ?? []).map((item) => `<tr><td>${escapeHtml(item.name)}</td><td class="amount">Rs ${Number(item.amount).toLocaleString()}</td></tr>`).join("");
  const paymentsHtml = (invoice.payments ?? []).map((payment) => `<tr><td>${escapeHtml(payment.paidAt)} · ${escapeHtml(payment.method)}</td><td class="amount">Rs ${Number(payment.amount).toLocaleString()}</td></tr>`).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>Receipt ${escapeHtml(invoice.invoiceNumber)}</title><style>body{font:14px Arial,sans-serif;color:#172033;margin:40px auto;max-width:720px}header{border-bottom:2px solid #2563eb;padding-bottom:18px}h1{margin:0 0 6px;font-size:24px}h2{font-size:16px;margin:28px 0 8px}.meta{color:#64748b;line-height:1.6}table{border-collapse:collapse;width:100%}td{border-bottom:1px solid #e2e8f0;padding:10px 0}.amount{text-align:right;font-weight:600}.total{font-size:18px;font-weight:700}.actions{margin-top:30px}@media print{.actions{display:none}body{margin:0}}</style></head><body><header><h1>${escapeHtml(organisation?.name ?? "Institution")}</h1><div class="meta">${escapeHtml(organisation?.address)} · ${escapeHtml(organisation?.phone)} · ${escapeHtml(organisation?.email)}</div></header><h2>Payment Receipt</h2><div class="meta">Receipt for invoice <strong>${escapeHtml(invoice.invoiceNumber)}</strong><br>Student: ${escapeHtml(student?.fullName)} (${escapeHtml(student?.studentId)}) · ${escapeHtml(student?.className)}<br>Issued: ${escapeHtml(invoice.issueDate)} · Due: ${escapeHtml(invoice.dueDate)}</div><h2>Charges</h2><table>${rows}<tr><td>Discount</td><td class="amount">- Rs ${Number(invoice.discount).toLocaleString()}</td></tr><tr><td>Fine</td><td class="amount">Rs ${Number(invoice.fine).toLocaleString()}</td></tr><tr class="total"><td>Total</td><td class="amount">Rs ${Number(invoice.total).toLocaleString()}</td></tr></table><h2>Payments</h2><table>${paymentsHtml || "<tr><td>No payments recorded</td><td></td></tr>"}<tr class="total"><td>Balance</td><td class="amount">Rs ${Number(invoice.balance).toLocaleString()}</td></tr></table><div class="actions"><button onclick="window.print()">Print receipt</button></div></body></html>`;
}
export async function addPayment(db: DB, orgId: string, userId: string, input: PaymentInput) { return db.transaction(async (tx) => { const [invoice] = await tx.select().from(invoices).where(and(eq(invoices.id, input.invoiceId), tenant(invoices, orgId))); if (!invoice) throw notFound("Invoice not found"); const [payment] = await tx.insert(payments).values({ ...input, organisationId: orgId, receivedBy: userId, amount: String(input.amount), paidAt: input.paidAt ? new Date(input.paidAt) : undefined }).returning(); const paid = Number(invoice.paid) + input.amount; await tx.update(invoices).set({ paid: String(paid), status: paid >= Number(invoice.total) ? "paid" : "partial" }).where(and(eq(invoices.id, input.invoiceId), tenant(invoices, orgId))); return payment; }); }
export async function feeSummary(db: DB, orgId: string, principal?: AuthUser) { const learnerIds = principal ? await learnerStudentIds(db, orgId, principal) : null; const conditions = [tenant(invoices, orgId)]; if (learnerIds) conditions.push(learnerIds.length ? inArray(invoices.studentId, learnerIds) : sql`false`); const [row] = await db.select({ total: sql<number>`coalesce(sum(${invoices.total}),0)`, paid: sql<number>`coalesce(sum(${invoices.paid}),0)`, outstanding: sql<number>`coalesce(sum(${invoices.total} - ${invoices.paid}),0)` }).from(invoices).where(and(...conditions)); return row; }
