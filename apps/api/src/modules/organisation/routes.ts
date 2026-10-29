import { Hono } from "hono";
import { z } from "zod";
import { DOCUMENT_SAMPLE_VALUES, DOCUMENT_TYPES, isTemplateDesign, idSchema } from "@edu/shared";
import type { AppEnv, DB } from "../../lib/types";
import { badRequest } from "../../lib/errors";
import { ok, okList, parse } from "../../lib/http";
import { writeAudit } from "../../lib/audit";
import { requireAuth, requireOrg, requirePermission } from "../../middleware/guards";
import { buildDocumentData } from "../../lib/document-data";
import { renderTemplateHtml } from "../../lib/document-template-renderer";
import * as svc from "./service";
import * as studentSvc from "../students/service";

export const organisationRoutes = new Hono<AppEnv>();
organisationRoutes.use("*", requireAuth, requireOrg);
const input = z.record(z.string(), z.unknown());
const brandingInput = z.object({
  name: z.string().trim().min(1).max(120),
  logoUrl: z.string().url().refine((value) => value.startsWith("https://"), "Logo URL must use HTTPS").nullable(),
  primaryColor: z.string().regex(/^#[\da-fA-F]{6}$/, "Use a six-digit hex color"),
}).strict();
organisationRoutes.get("/", requirePermission("organisation.view"), async (c) => ok(c, await svc.get(c.get("db"), c.get("orgId")!)));
organisationRoutes.get("/branding", requirePermission("organisation.view"), async (c) => ok(c, await svc.getBranding(c.get("db"), c.get("orgId")!)));
organisationRoutes.put("/", requirePermission("organisation.edit"), async (c) => ok(c, await svc.update(c.get("db"), c.get("orgId")!, parse(input, await c.req.json()))));
organisationRoutes.put("/branding", requirePermission("organisation.edit"), async (c) => ok(c, await svc.updateBranding(c.get("db"), c.get("orgId")!, parse(brandingInput, await c.req.json()))));
organisationRoutes.get("/features", requirePermission("organisation.view"), async (c) => okList(c, await svc.listFeatures(c.get("db"), c.get("orgId")!), 0, 1, 1000));
organisationRoutes.get("/audit", requirePermission("audit.view"), async (c) => okList(c, await svc.listAudit(c.get("db"), c.get("orgId")!), 0, 1, 1000));

const templateInput = z.object({
  name: z.string().trim().min(2).max(100),
  documentType: z.enum(DOCUMENT_TYPES),
  design: z.record(z.string(), z.unknown()),
  isDefault: z.boolean().default(false),
});

const importInput = z.object({
  templates: z.array(templateInput).min(1).max(100),
});

const previewInput = z.object({
  documentType: z.enum(DOCUMENT_TYPES).default("custom"),
  design: z.record(z.string(), z.unknown()),
  studentId: z.string().uuid().optional(),
});

function assertDesign(design: unknown) {
  if (!isTemplateDesign(design)) {
    throw badRequest("Template design is not valid. Expected a version 2 canvas design.", "validation");
  }
  if (design.page.width < 100 || design.page.height < 100 || design.page.width > 5000 || design.page.height > 5000) {
    throw badRequest("Template page size is out of range.", "validation");
  }
  if (design.elements.length > 400) {
    throw badRequest("Template has too many elements.", "validation");
  }
  return design;
}

async function previewData(db: DB, orgId: string, studentId?: string) {
  const organisation = await svc.get(db, orgId);
  const base = {
    ...DOCUMENT_SAMPLE_VALUES,
    schoolName: organisation.name,
    schoolAddress: organisation.address ?? DOCUMENT_SAMPLE_VALUES.schoolAddress,
    schoolPhone: organisation.phone ?? DOCUMENT_SAMPLE_VALUES.schoolPhone,
    schoolEmail: organisation.email ?? DOCUMENT_SAMPLE_VALUES.schoolEmail,
    schoolLogoUrl: organisation.logoUrl ?? "",
  } as Record<string, string>;
  if (!studentId) return base;
  try {
    const student = await studentSvc.getStudent(db, orgId, studentId);
    return {
      ...base,
      ...buildDocumentData(student, {
        name: organisation.name,
        address: organisation.address,
        phone: organisation.phone,
        email: organisation.email,
        logoUrl: organisation.logoUrl,
      }),
    };
  } catch {
    return base;
  }
}

organisationRoutes.get("/document-templates", requirePermission("organisation.view"), async (c) => okList(c, await svc.listDocumentTemplates(c.get("db"), c.get("orgId")!), 0, 1, 1000));

organisationRoutes.post("/document-templates", requirePermission("organisation.edit"), async (c) => {
  const body = parse(templateInput, await c.req.json());
  assertDesign(body.design);
  const row = await svc.saveDocumentTemplate(c.get("db"), c.get("orgId")!, c.get("user")!.id, undefined, body);
  await writeAudit(c, { action: "create", entity: "document_template", entityId: row.id, newValue: { name: row.name, documentType: row.documentType } });
  return ok(c, row, 201);
});

organisationRoutes.post("/document-templates/import", requirePermission("organisation.edit"), async (c) => {
  const body = parse(importInput, await c.req.json());
  for (const template of body.templates) assertDesign(template.design);
  const result = await svc.importDocumentTemplates(
    c.get("db"),
    c.get("orgId")!,
    c.get("user")!.id,
    body.templates.map((template) => ({
      name: template.name,
      documentType: template.documentType,
      design: template.design,
      isDefault: template.isDefault,
    })),
  );
  await writeAudit(c, { action: "import", entity: "document_template", newValue: { imported: result.imported.length, failed: result.failed.length } });
  return ok(c, { imported: result.imported.length, failed: result.failed });
});

organisationRoutes.post("/document-templates/preview", requirePermission("organisation.view"), async (c) => {
  const body = parse(previewInput, await c.req.json());
  const design = assertDesign(body.design);
  const data = await previewData(c.get("db"), c.get("orgId")!, body.studentId);
  return c.html(await renderTemplateHtml(design, data, { title: "Document preview" }));
});

organisationRoutes.get("/document-templates/:id/preview", requirePermission("organisation.view"), async (c) => {
  const row = await svc.getDocumentTemplate(c.get("db"), c.get("orgId")!, c.req.param("id"));
  const design = assertDesign(row.design);
  const data = await previewData(c.get("db"), c.get("orgId")!, c.req.query("studentId"));
  return c.html(await renderTemplateHtml(design, data, { title: row.name }));
});

organisationRoutes.put("/document-templates/:id", requirePermission("organisation.edit"), async (c) => {
  const body = parse(templateInput, await c.req.json());
  assertDesign(body.design);
  const row = await svc.saveDocumentTemplate(c.get("db"), c.get("orgId")!, c.get("user")!.id, c.req.param("id"), body);
  await writeAudit(c, { action: "update", entity: "document_template", entityId: row.id, newValue: { name: row.name, documentType: row.documentType, isDefault: row.isDefault } });
  return ok(c, row);
});

organisationRoutes.delete("/document-templates/:id", requirePermission("organisation.edit"), async (c) => {
  const id = c.req.param("id");
  await svc.deleteDocumentTemplate(c.get("db"), c.get("orgId")!, id);
  await writeAudit(c, { action: "delete", entity: "document_template", entityId: id });
  return ok(c, { deleted: true });
});
void idSchema;
