import { Hono } from "hono";
import { z } from "zod";
import { feeCategoryInputSchema, feeStructureInputSchema, generateInvoicesSchema, invoiceInputSchema, manualPaymentSubmissionSchema, paymentInitiateSchema, paymentInputSchema, paymentMethodInputSchema, paymentSubmissionReviewSchema } from "@edu/shared";
import type { AppEnv } from "../../lib/types";
import { ok, okList, parse } from "../../lib/http";
import { requireAuth, requireOrg, requirePermission } from "../../middleware/guards";
import * as svc from "./service";
import { env } from "../../env";
import { getPaymentIntent } from "../../lib/redis";
import { createEsewaRequest } from "./esewa";
import { writeAudit } from "../../lib/audit";
export const feeRoutes = new Hono<AppEnv>(); feeRoutes.use("*", requireAuth, requireOrg);
const db = (c: any) => c.get("db"); const org = (c: any) => c.get("orgId")!; const user = (c: any) => c.get("user")!.id;
const discountInput = z.object({ amount: z.number().positive(), reason: z.string().trim().max(200).nullable().optional() });
feeRoutes.get("/categories", requirePermission("fee.view"), async (c) => { const rows = await svc.listCategories(db(c), org(c)); return okList(c, rows, rows.length, 1, 1000); });
feeRoutes.post("/categories", requirePermission("fee.create"), async (c) => ok(c, await svc.createCategory(db(c), org(c), parse(feeCategoryInputSchema, await c.req.json())), 201));
feeRoutes.put("/categories/:id", requirePermission("fee.edit"), async (c) => ok(c, await svc.updateCategory(db(c), org(c), c.req.param("id"), parse(feeCategoryInputSchema.partial(), await c.req.json()))));
feeRoutes.delete("/categories/:id", requirePermission("fee.delete"), async (c) => { await svc.deleteCategory(db(c), org(c), c.req.param("id")); return ok(c, { deleted: true }); });
feeRoutes.get("/structures", requirePermission("fee.view"), async (c) => { const rows = await svc.listStructures(db(c), org(c)); return okList(c, rows, rows.length, 1, 1000); });
feeRoutes.post("/structures", requirePermission("fee.create"), async (c) => ok(c, await svc.createStructure(db(c), org(c), parse(feeStructureInputSchema, await c.req.json())), 201));
feeRoutes.put("/structures/:id", requirePermission("fee.edit"), async (c) => ok(c, await svc.updateStructure(db(c), org(c), c.req.param("id"), parse(feeStructureInputSchema.partial(), await c.req.json()))));
feeRoutes.delete("/structures/:id", requirePermission("fee.delete"), async (c) => { await svc.deleteStructure(db(c), org(c), c.req.param("id")); return ok(c, { deleted: true }); });
feeRoutes.get("/invoices", requirePermission("invoice.view"), async (c) => { const rows = await svc.listInvoices(db(c), org(c), c.get("user")!); return okList(c, rows, rows.length, 1, 1000); });
feeRoutes.get("/invoices/:id", requirePermission("invoice.view"), async (c) => ok(c, await svc.getInvoice(db(c), org(c), c.req.param("id"), c.get("user")!)));
feeRoutes.post("/invoices", requirePermission("invoice.create"), async (c) => ok(c, await svc.createInvoice(db(c), org(c), user(c), parse(invoiceInputSchema, await c.req.json())), 201));
feeRoutes.post("/invoices/generate", requirePermission("invoice.create"), async (c) => ok(c, await svc.generateInvoices(db(c), org(c), user(c), parse(generateInvoicesSchema, await c.req.json())), 201));
feeRoutes.post("/invoices/:id/discount", requirePermission("invoice.edit"), async (c) => { const input = parse(discountInput, await c.req.json()); const row = await svc.applyDiscount(db(c), org(c), user(c), c.req.param("id"), input.amount, input.reason); await writeAudit(c, { action: "discount", entity: "invoice", entityId: c.req.param("id"), newValue: input }); return ok(c, row); });
feeRoutes.get("/invoices/:id/receipt", requirePermission("invoice.view"), async (c) => c.html(svc.buildReceiptHtml(await svc.receiptContext(db(c), org(c), c.req.param("id"), c.get("user")!))));
feeRoutes.post("/payments", requirePermission("payment.create"), async (c) => ok(c, await svc.addPayment(db(c), org(c), user(c), parse(paymentInputSchema, await c.req.json())), 201));
feeRoutes.post("/payments/esewa", requirePermission("payment.create"), async (c) => ok(c, await svc.initiateEsewa(db(c), org(c), c.get("user")!, parse(paymentInitiateSchema, await c.req.json()).invoiceId)));
feeRoutes.get("/payment-methods", requirePermission("payment.view"), async (c) => okList(c, await svc.listPaymentMethods(db(c), org(c)), 0, 1, 1000));
feeRoutes.post("/payment-methods", requirePermission("payment.edit"), async (c) => ok(c, await svc.createPaymentMethod(db(c), org(c), parse(paymentMethodInputSchema, await c.req.json())), 201));
feeRoutes.put("/payment-methods/:id", requirePermission("payment.edit"), async (c) => ok(c, await svc.updatePaymentMethod(db(c), org(c), c.req.param("id"), parse(paymentMethodInputSchema.partial(), await c.req.json()))));
feeRoutes.delete("/payment-methods/:id", requirePermission("payment.edit"), async (c) => { await svc.deletePaymentMethod(db(c), org(c), c.req.param("id")); return ok(c, { deleted: true }); });
feeRoutes.get("/submissions", requirePermission("payment.view"), async (c) => okList(c, await svc.listPaymentSubmissions(db(c), org(c), c.get("user")!), 0, 1, 1000));
feeRoutes.post("/submissions", requirePermission("payment.create"), async (c) => ok(c, await svc.submitManualPayment(db(c), org(c), c.get("user")!, parse(manualPaymentSubmissionSchema, await c.req.json())), 201));
feeRoutes.put("/submissions/:id/review", requirePermission("payment.approve"), async (c) => ok(c, await svc.reviewPaymentSubmission(db(c), org(c), user(c), c.req.param("id"), parse(paymentSubmissionReviewSchema, await c.req.json()))));
feeRoutes.get("/summary", requirePermission("fee.view"), async (c) => ok(c, await svc.feeSummary(db(c), org(c), c.get("user")!)));

export const paymentCallbackRoutes = new Hono<AppEnv>();
paymentCallbackRoutes.get("/esewa/checkout/:transactionUuid", async (c) => {
  const transactionUuid = c.req.param("transactionUuid");
  const raw = await getPaymentIntent(transactionUuid);
  if (!raw) return c.html("<h1>Payment session expired</h1>", 410);
  const intent = JSON.parse(raw) as { amount: number };
  const fields = createEsewaRequest({ amount: intent.amount, transactionUuid });
  const inputs = Object.entries(fields).map(([key, value]) => `<input type="hidden" name="${key}" value="${String(value).replace(/&/g, "&amp;").replace(/\"/g, "&quot;")}" />`).join("");
  return c.html(`<!doctype html><html><body onload="document.forms[0].submit()"><p>Redirecting to eSewa...</p><form method="POST" action="${env.ESEWA_FORM_URL}">${inputs}</form></body></html>`);
});
paymentCallbackRoutes.get("/esewa/success", async (c) => {
  const transactionUuid = c.req.query("transaction_uuid");
  if (!transactionUuid) return c.redirect(`${env.WEB_ORIGIN}/?payment=failed`);
  try {
    const raw = await getPaymentIntent(transactionUuid);
    if (!raw) return c.redirect(`${env.WEB_ORIGIN}/?payment=failed`);
    const intent = JSON.parse(raw) as { orgId: string };
    await c.var.client.query("SELECT set_config('app.current_org_id', $1, false)", [intent.orgId]);
    const result = await svc.completeEsewa(c.get("db"), intent.orgId, transactionUuid);
    return c.redirect(`${env.WEB_ORIGIN}/?payment=${result.duplicate ? "already-completed" : "success"}&invoice=${encodeURIComponent(result.invoiceId)}`);
  } catch {
    return c.redirect(`${env.WEB_ORIGIN}/?payment=failed`);
  }
});
paymentCallbackRoutes.get("/esewa/failure", (c) => c.redirect(`${env.WEB_ORIGIN}/?payment=cancelled`));
