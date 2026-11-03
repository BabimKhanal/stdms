import { Hono } from "hono";
import type { MiddlewareHandler } from "hono";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import {
  DOCUMENT_TYPES,
  guardianInputSchema,
  isTemplateDesign,
  linkGuardianSchema,
  studentInputSchema,
  studentListQuerySchema,
} from "@edu/shared";
import type { AppEnv } from "../../lib/types";
import { ok, okList, parse } from "../../lib/http";
import {
  requireAuth,
  requireOrg,
  requirePermission,
} from "../../middleware/guards";
import { writeAudit } from "../../lib/audit";
import * as svc from "./service";
import { getCurrentYearId } from "../academics/service";
import { documentTemplates, organisations } from "../../db/schema";
import { badRequest, forbidden, notFound } from "../../lib/errors";
import { buildDocumentData } from "../../lib/document-data";
import { renderTemplatePdf } from "../../lib/document-pdf";

const studentProfileUpdateSchema = studentInputSchema.omit({ academicYearId: true, classId: true, sectionId: true, rollNumber: true, status: true }).partial();
const studentDocumentInput = z.object({ documentType: z.string().trim().min(2).max(60), title: z.string().trim().min(2).max(120), fileUrl: z.string().trim().url().max(2000), fileName: z.string().trim().max(255).nullable().optional(), mimeType: z.string().trim().max(120).nullable().optional() }).strict();

export const studentRoutes = new Hono<AppEnv>();

studentRoutes.use("*", requireAuth, requireOrg);

const canViewOwnDocument: MiddlewareHandler<AppEnv> = async (c, next) => {
  const user = c.get("user")!;
  if (user.isPlatformAdmin || user.permissions.includes("student.view") || user.studentId === c.req.param("id")) {
    await next();
    return;
  }
  throw forbidden("You can only view your own student documents");
};

/* List + search + filter + server-side pagination (SRS §65) */
studentRoutes.get("/", requirePermission("student.view"), async (c) => {
  const q = parse(studentListQuerySchema, c.req.query());
  const db = c.get("db");
  const orgId = c.get("orgId")!;
  const yearId =
    q.status === "graduated"
      ? undefined
      : ((await getCurrentYearId(db, orgId)) ?? undefined);
  const { data, total } = await svc.listStudents(db, orgId, {
    ...q,
    academicYearId: yearId,
    principal: c.get("user")!,
  });
  return okList(c, data, total, q.page, q.pageSize);
});

studentRoutes.get(
  "/:id/identity-card",
  requirePermission("student.view"),
  async (c) =>
    c.html(
      await svc.identityCardHtml(
        c.get("db"),
        c.get("orgId")!,
        c.req.param("id"),
        c.get("user")!,
      ),
    ),
);

studentRoutes.get(
  "/:id/document",
  canViewOwnDocument,
  async (c) => {
    const db = c.get("db");
    const orgId = c.get("orgId")!;
    const studentId = c.req.param("id");
    const documentType = c.req.query("type") ?? "identity_card";
    const templateId = c.req.query("templateId");
    if (templateId && !z.uuid().safeParse(templateId).success) {
      throw badRequest("Invalid document template", "validation");
    }
    if (!DOCUMENT_TYPES.includes(documentType as (typeof DOCUMENT_TYPES)[number])) {
      throw badRequest("Unsupported document type", "validation");
    }
    const student = await svc.getStudent(db, orgId, studentId, c.get("user")!);
    const [template] = await db
      .select({ name: documentTemplates.name, design: documentTemplates.design })
      .from(documentTemplates)
      .where(
        and(
          eq(documentTemplates.organisationId, orgId),
          eq(documentTemplates.documentType, documentType),
          ...(templateId ? [eq(documentTemplates.id, templateId)] : [eq(documentTemplates.isDefault, 1)]),
        ),
      )
      .limit(1);
    if (!template) throw notFound(`No default ${documentType} template is configured`);
    if (!isTemplateDesign(template.design)) throw badRequest("The configured document template is invalid", "validation");

    const [organisation] = await db
      .select({ name: organisations.name, address: organisations.address, phone: organisations.phone, email: organisations.email, logoUrl: organisations.logoUrl })
      .from(organisations)
      .where(eq(organisations.id, orgId))
      .limit(1);
    const data = buildDocumentData(student, organisation);
    const pdf = await renderTemplatePdf(template.design, [{ data }], { title: `${student.fullName} - ${template.name}` });
    await writeAudit(c, {
      action: "generate",
      entity: "student_document",
      entityId: student.id,
      newValue: { documentType, templateName: template.name },
    });
    const filename = `${documentType}-${student.studentId}`.replace(/[^a-zA-Z0-9._-]+/g, "-").toLowerCase();
    return new Response(pdf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  },
);
studentRoutes.get("/:id", requirePermission("student.view"), async (c) => {
  return ok(
    c,
    await svc.getStudent(
      c.get("db"),
      c.get("orgId")!,
      c.req.param("id"),
      c.get("user")!,
    ),
  );
});

studentRoutes.post("/", requirePermission("student.create"), async (c) => {
  const input = parse(studentInputSchema, await c.req.json());
  const orgId = c.get("orgId")!;
  const yearId = input.classId
    ? (input.academicYearId ?? (await getCurrentYearId(c.get("db"), orgId)))
    : null;
  const row = await svc.createStudent(c.get("db"), orgId, {
    ...input,
    academicYearId: yearId,
  });
  await writeAudit(c, {
    action: "create",
    entity: "student",
    entityId: row.id,
    newValue: input,
  });
  return ok(c, row, 201);
});

studentRoutes.post("/:id/documents", requirePermission("student.edit"), async (c) => {
  const studentId = c.req.param("id");
  const input = parse(studentDocumentInput, await c.req.json());
  const row = await svc.addStudentDocument(c.get("db"), c.get("orgId")!, studentId, c.get("user")!.id, input);
  await writeAudit(c, { action: "upload", entity: "student_document", entityId: row.id, newValue: { studentId, documentType: input.documentType, title: input.title } });
  return ok(c, row, 201);
});

studentRoutes.delete("/:id/documents/:documentId", requirePermission("student.edit"), async (c) => {
  await svc.deleteStudentDocument(c.get("db"), c.get("orgId")!, c.req.param("id"), c.req.param("documentId"));
  await writeAudit(c, { action: "delete", entity: "student_document", entityId: c.req.param("documentId") });
  return ok(c, { deleted: true });
});

studentRoutes.put("/:id", requirePermission("student.edit"), async (c) => {
  const input = parse(studentProfileUpdateSchema, await c.req.json());
  const before = await svc
    .getStudent(c.get("db"), c.get("orgId")!, c.req.param("id"), c.get("user")!)
    .catch(() => null);
  const row = await svc.updateStudent(
    c.get("db"),
    c.get("orgId")!,
    c.req.param("id"),
    input,
  );
  await writeAudit(c, {
    action: "update",
    entity: "student",
    entityId: row.id,
    oldValue: before
      ? { status: before.status, phone: before.phone, address: before.address }
      : null,
    newValue: input,
  });
  return ok(c, row);
});

studentRoutes.delete("/:id", requirePermission("student.delete"), async (c) => {
  await svc.getStudent(
    c.get("db"),
    c.get("orgId")!,
    c.req.param("id"),
    c.get("user")!,
  );
  await svc.deleteStudent(c.get("db"), c.get("orgId")!, c.req.param("id"));
  await writeAudit(c, {
    action: "delete",
    entity: "student",
    entityId: c.req.param("id"),
  });
  return ok(c, { deleted: true });
});

studentRoutes.post(
  "/:id/account",
  requirePermission("user.create"),
  async (c) => {
    const result = await svc.provisionStudentAccount(
      c.get("db"),
      c.get("orgId")!,
      c.req.param("id"),
    );
    await writeAudit(c, {
      action: "provision_account",
      entity: "student",
      entityId: c.req.param("id"),
    });
    return ok(c, result, result.created ? 201 : 200);
  },
);

/* Guardians */
const guardianQuery = z.object({ search: z.string().max(80).optional() });

export const guardianRoutes = new Hono<AppEnv>();
guardianRoutes.use("*", requireAuth, requireOrg);

guardianRoutes.get("/", requirePermission("guardian.view"), async (c) => {
  const q = parse(guardianQuery, c.req.query());
  const rows = await svc.listGuardians(c.get("db"), c.get("orgId")!, q.search);
  return okList(c, rows, rows.length, 1, 1000);
});

guardianRoutes.post("/", requirePermission("guardian.create"), async (c) => {
  const input = parse(guardianInputSchema, await c.req.json());
  const row = await svc.createGuardian(c.get("db"), c.get("orgId")!, input);
  await writeAudit(c, {
    action: "create",
    entity: "guardian",
    entityId: row.id,
    newValue: input,
  });
  return ok(c, row, 201);
});

guardianRoutes.put("/:id", requirePermission("guardian.edit"), async (c) => {
  const input = parse(guardianInputSchema.partial(), await c.req.json());
  const row = await svc.updateGuardian(
    c.get("db"),
    c.get("orgId")!,
    c.req.param("id"),
    input,
  );
  await writeAudit(c, {
    action: "update",
    entity: "guardian",
    entityId: row.id,
    newValue: input,
  });
  return ok(c, row);
});

guardianRoutes.post(
  "/:id/account",
  requirePermission("user.create"),
  async (c) => {
    const result = await svc.provisionGuardianAccount(
      c.get("db"),
      c.get("orgId")!,
      c.req.param("id"),
    );
    await writeAudit(c, {
      action: "provision_account",
      entity: "guardian",
      entityId: c.req.param("id"),
    });
    return ok(c, result, result.created ? 201 : 200);
  },
);

guardianRoutes.post("/link", requirePermission("guardian.edit"), async (c) => {
  const input = parse(linkGuardianSchema, await c.req.json());
  const row = await svc.linkGuardian(
    c.get("db"),
    c.get("orgId")!,
    input.studentId,
    input.guardianId,
    input.isPrimary,
  );
  return ok(c, row, 201);
});

guardianRoutes.post(
  "/unlink",
  requirePermission("guardian.edit"),
  async (c) => {
    const input = parse(linkGuardianSchema, await c.req.json());
    await svc.unlinkGuardian(
      c.get("db"),
      c.get("orgId")!,
      input.studentId,
      input.guardianId,
    );
    return ok(c, { unlinked: true });
  },
);

/* Enrolment / promotion wizard */
export const enrolmentRoutes = new Hono<AppEnv>();
enrolmentRoutes.use("*", requireAuth, requireOrg);

const promoteSchema = z.object({
  fromYearId: z.uuid(),
  toYearId: z.uuid(),
  reason: z.string().trim().min(3).max(500),
  entries: z
    .array(
      z.object({
        studentId: z.uuid(),
        status: z.enum([
          "promoted",
          "repeated",
          "transferred",
          "graduated",
          "withdrawn",
        ]),
        toClassId: z.uuid().nullable().optional(),
        toSectionId: z.uuid().nullable().optional(),
        rollNumber: z.number().int().min(0).nullable().optional(),
      }),
    )
    .min(1),
});

const lifecycleSchema = z.object({
  status: z.enum([
    "active",
    "graduated",
    "suspended",
    "withdrawn",
    "transferred",
    "alumni",
  ]),
  reason: z.string().trim().min(3).max(500),
  effectiveDate: z.iso.date().optional(),
});

studentRoutes.post(
  "/:id/lifecycle",
  requirePermission("enrolment.approve"),
  async (c) => {
    const input = parse(lifecycleSchema, await c.req.json());
    const row = await svc.transitionStudentStatus(
      c.get("db"),
      c.get("orgId")!,
      c.req.param("id"),
      input.status,
      c.get("user")!.id,
      input.reason,
      input.effectiveDate,
    );
    await writeAudit(c, {
      action: "status_change",
      entity: "student",
      entityId: row.student.id,
      oldValue: { status: row.previousStatus },
      newValue: input,
    });
    return ok(c, row.student);
  },
);

enrolmentRoutes.post(
  "/promote",
  requirePermission("enrolment.approve"),
  async (c) => {
    const input = parse(promoteSchema, await c.req.json());
    const result = await svc.promoteStudents(
      c.get("db"),
      c.get("orgId")!,
      input.fromYearId,
      input.toYearId,
      input.entries,
      c.get("user")!.id,
      input.reason,
    );
    await writeAudit(c, {
      action: "promote",
      entity: "enrolment",
      newValue: { fromYearId: input.fromYearId, toYearId: input.toYearId, reason: input.reason, entries: result },
    });
    return ok(c, result);
  },
);
