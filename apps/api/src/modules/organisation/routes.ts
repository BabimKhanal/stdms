import { Hono } from "hono";
import { z } from "zod";
import { idSchema } from "@edu/shared";
import type { AppEnv } from "../../lib/types";
import { ok, okList, parse } from "../../lib/http";
import { requireAuth, requireOrg, requirePermission } from "../../middleware/guards";
import * as svc from "./service";

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
const templateInput = z.object({ name: z.string().trim().min(2).max(100), documentType: z.enum(["identity_card", "transcript", "marksheet", "certificate", "custom"]), design: z.record(z.string(), z.unknown()), isDefault: z.boolean().default(false) });
organisationRoutes.get("/document-templates", requirePermission("organisation.view"), async (c) => okList(c, await svc.listDocumentTemplates(c.get("db"), c.get("orgId")!), 0, 1, 1000));
organisationRoutes.post("/document-templates", requirePermission("organisation.edit"), async (c) => ok(c, await svc.saveDocumentTemplate(c.get("db"), c.get("orgId")!, c.get("user")!.id, undefined, parse(templateInput, await c.req.json())), 201));
organisationRoutes.put("/document-templates/:id", requirePermission("organisation.edit"), async (c) => ok(c, await svc.saveDocumentTemplate(c.get("db"), c.get("orgId")!, c.get("user")!.id, c.req.param("id"), parse(templateInput, await c.req.json()))));
organisationRoutes.delete("/document-templates/:id", requirePermission("organisation.edit"), async (c) => { await svc.deleteDocumentTemplate(c.get("db"), c.get("orgId")!, c.req.param("id")); return ok(c, { deleted: true }); });
void idSchema;
