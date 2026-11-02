import { Hono, type Context } from "hono";
import { z } from "zod";
import type { AppEnv } from "../../lib/types";
import { ok, okList, parse } from "../../lib/http";
import { forbidden, unauthorized } from "../../lib/errors";
import { readiness } from "../../lib/health";
import * as svc from "./service";
export const superAdminRoutes = new Hono<AppEnv>();
superAdminRoutes.use("*", async (c, next) => {
  const user = c.get("user");
  if (!user) throw unauthorized();
  if (!user.isPlatformAdmin) throw forbidden("Platform admin access required");
  await next();
});
const organisationInput = z.object({
  name: z.string().trim().min(2).max(160),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  academicType: z
    .enum(["school", "college", "academy", "university"])
    .optional(),
  status: z.enum(["active", "trial", "suspended"]).optional(),
  plan: z.string().trim().min(1).max(60).optional(),
  email: z
    .union([z.email(), z.literal("")])
    .nullable()
    .optional(),
  phone: z.string().max(40).nullable().optional(),
  country: z.string().trim().min(2).max(100).optional(),
  currency: z.string().trim().length(3).optional(),
  timezone: z.string().trim().min(1).max(80).optional(),
  maxStudents: z.number().int().min(0).max(1_000_000).optional(),
  maxUsers: z.number().int().min(0).max(100_000).optional(),
  maxStorageMb: z.number().int().min(0).max(10_000_000).optional(),
  primaryColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  secondaryColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
});
const updateOrganisationInput = organisationInput
  .partial()
  .refine((value) => Object.keys(value).length > 0);
async function auditPlatformAction(
  c: Context<AppEnv>,
  action: string,
  entity: string,
  entityId: string,
  oldValue: unknown,
  newValue: unknown,
) {
  const user = c.get("user");
  if (!user) return;
  await svc.writePlatformAudit(c.get("db"), {
    actorId: user.id,
    actorName: user.name,
    action,
    entity,
    entityId,
    oldValue,
    newValue,
    ip:
      c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
      c.req.header("x-real-ip") ??
      null,
  });
}
superAdminRoutes.get("/organisations", async (c) =>
  okList(c, await svc.listOrganisations(c.get("db")), 0, 1, 1000),
);
superAdminRoutes.post("/organisations", async (c) => {
  const input = parse(organisationInput, await c.req.json());
  const organisation = await svc.saveOrganisation(
    c.get("db"),
    undefined,
    input,
  );
  await auditPlatformAction(
    c,
    "tenant.created",
    "organisation",
    organisation.id,
    null,
    {
      name: organisation.name,
      slug: organisation.slug,
      status: organisation.status,
      plan: organisation.plan,
    },
  );
  return ok(c, organisation, 201);
});
superAdminRoutes.put("/organisations/:id", async (c) => {
  const id = c.req.param("id");
  const before = await svc.getOrganisation(c.get("db"), id);
  const input = parse(updateOrganisationInput, await c.req.json());
  const organisation = await svc.saveOrganisation(c.get("db"), id, input);
  await auditPlatformAction(
    c,
    "tenant.updated",
    "organisation",
    organisation.id,
    before,
    organisation,
  );
  return ok(c, organisation);
});
superAdminRoutes.get("/organisations/:id/profile", async (c) =>
  ok(c, await svc.getOrganisationProfile(c.get("db"), c.req.param("id"))),
);
superAdminRoutes.get("/organisations/:id/features", async (c) =>
  ok(c, await svc.listFlags(c.get("db"), c.req.param("id"))),
);
superAdminRoutes.put("/organisations/:id/features/:flag", async (c) => {
  const orgId = c.req.param("id");
  const flag = parse(
    z.string().regex(/^[a-z][a-z0-9_-]{1,63}$/),
    c.req.param("flag"),
  );
  const enabled = parse(
    z.object({ enabled: z.boolean() }),
    await c.req.json(),
  ).enabled;
  const before = (await svc.listFlags(c.get("db"), orgId)).find(
    (item) => item.flag === flag,
  );
  const saved = await svc.saveFlag(c.get("db"), orgId, flag, enabled);
  await auditPlatformAction(
    c,
    "feature.updated",
    "feature_flag",
    orgId,
    { flag, enabled: before?.enabled ?? true },
    { flag, enabled },
  );
  return ok(c, saved);
});
superAdminRoutes.get("/stats", async (c) =>
  ok(c, await svc.stats(c.get("db"))),
);
superAdminRoutes.get("/health", async (c) => ok(c, await readiness()));
superAdminRoutes.get("/audit", async (c) =>
  ok(c, await svc.listPlatformAudit(c.get("db"))),
);
