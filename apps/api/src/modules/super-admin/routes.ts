import { Hono, type Context } from "hono";
import { z } from "zod";
import type { AppEnv } from "../../lib/types";
import { ok, okList, parse } from "../../lib/http";
import { forbidden, unauthorized } from "../../lib/errors";
import { readiness } from "../../lib/health";
import { env } from "../../env";
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
const platformEmailInput = z.object({
  provider: z.enum(["console", "resend", "sendgrid", "mailgun", "smtp"]),
  enabled: z.boolean(),
  fromName: z.string().trim().min(1).max(120),
  fromEmail: z.email(),
  replyTo: z.union([z.email(), z.literal("")]).nullable().optional(),
  footer: z.string().max(1000).nullable().optional(),
  providerDomain: z.string().max(255).nullable().optional(),
  smtpHost: z.string().max(255).nullable().optional(),
  smtpPort: z.number().int().min(1).max(65535).nullable().optional(),
  smtpSecure: z.boolean().optional(),
  smtpUsername: z.string().max(255).nullable().optional(),
  apiKey: z.string().max(500).optional(),
  smtpPassword: z.string().max(500).optional(),
});
const platformTemplateInput = z.object({
  key: z.string().trim().min(1).max(80).regex(/^[a-z0-9_]+$/),
  name: z.string().trim().min(1).max(120),
  subject: z.string().trim().min(1).max(300),
  htmlBody: z.string().min(1).max(100000),
  textBody: z.string().max(50000).nullable(),
  isActive: z.boolean(),
});
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
superAdminRoutes.get("/email-settings", async (c) =>
  ok(c, await svc.getPlatformEmailSettings(c.get("db"))),
);
superAdminRoutes.put("/email-settings", async (c) => {
  const input = parse(platformEmailInput, await c.req.json());
  const saved = await svc.savePlatformEmailSettings(c.get("db"), input);
  await auditPlatformAction(c, "platform_email.updated", "platform_email_settings", saved.id ?? "default", null, {
    provider: saved.provider,
    enabled: saved.enabled,
    fromEmail: saved.fromEmail,
    hasApiKey: saved.hasApiKey,
    hasSmtpPassword: saved.hasSmtpPassword,
  });
  return ok(c, saved);
});
superAdminRoutes.post("/email-settings/test", async (c) => {
  const body = parse(z.object({ to: z.email() }), await c.req.json());
  const result = await svc.testPlatformEmail(c.get("db"), body.to);
  await auditPlatformAction(c, "platform_email.test", "platform_email_settings", "default", null, result);
  return ok(c, result);
});
superAdminRoutes.get("/email-templates", async (c) =>
  ok(c, await svc.listPlatformEmailTemplates(c.get("db"))),
);
superAdminRoutes.post("/email-templates", async (c) => {
  const input = parse(platformTemplateInput, await c.req.json());
  const row = await svc.savePlatformEmailTemplate(c.get("db"), c.get("user")!.id, undefined, input);
  await auditPlatformAction(c, "platform_email_template.created", "platform_email_template", row.id, null, { key: row.key, name: row.name });
  return ok(c, row, 201);
});
superAdminRoutes.put("/email-templates/:id", async (c) => {
  const input = parse(platformTemplateInput.omit({ key: true }), await c.req.json());
  const row = await svc.savePlatformEmailTemplate(c.get("db"), c.get("user")!.id, c.req.param("id"), { key: "", ...input });
  await auditPlatformAction(c, "platform_email_template.updated", "platform_email_template", row.id, null, { name: row.name, isActive: row.isActive });
  return ok(c, row);
});
superAdminRoutes.delete("/email-templates/:id", async (c) => {
  await svc.deletePlatformEmailTemplate(c.get("db"), c.req.param("id"));
  await auditPlatformAction(c, "platform_email_template.deleted", "platform_email_template", c.req.param("id"), null, null);
  return ok(c, { deleted: true });
});
superAdminRoutes.post("/email-templates/preview", async (c) =>
  ok(c, await svc.previewPlatformEmail(c.get("db"), parse(z.object({ subject: z.string().max(300), htmlBody: z.string().max(100000), textBody: z.string().max(50000).nullable().optional() }), await c.req.json()))),
);
superAdminRoutes.get("/email-deliveries", async (c) =>
  ok(c, await svc.listPlatformEmailDeliveries(c.get("db"))),
);
superAdminRoutes.post("/email-deliveries/broadcast", async (c) => {
  const input = parse(z.object({ templateKey: z.string().min(1).max(80), title: z.string().trim().min(1).max(300), body: z.string().trim().min(1).max(100000), organisationIds: z.array(z.string().uuid()).max(10000).optional() }), await c.req.json());
  const result = await svc.sendPlatformBroadcast(c.get("db"), c.get("user")!.id, input);
  await auditPlatformAction(c, "platform_email.broadcast", "platform_email_delivery", "broadcast", null, result);
  return ok(c, result, 201);
});
superAdminRoutes.post("/email-deliveries/:id/retry", async (c) => {
  const row = await svc.retryPlatformEmailDelivery(c.get("db"), c.req.param("id"), c.get("user")!.id);
  await auditPlatformAction(c, "platform_email.retry", "platform_email_delivery", row.id, null, { status: row.status });
  return ok(c, row);
});
superAdminRoutes.get("/audit", async (c) =>
  ok(c, await svc.listPlatformAudit(c.get("db"))),
);

const changeEmailInput = z.object({
  currentEmail: z.string().email(),
  newEmail: z.string().email(),
});
const changePasswordInput = z.object({
  currentPassword: z.string().min(6),
  newPassword: z.string().min(8).max(200),
});

/** POST /super/change-email — update the platform admin's own email. */
superAdminRoutes.post("/change-email", async (c) => {
  const user = c.get("user");
  if (!user) throw unauthorized();
  const body = parse(changeEmailInput, await c.req.json());
  const updated = await svc.changePlatformEmail(
    c.get("db"),
    user.id,
    body.currentEmail,
    body.newEmail,
  );
  await auditPlatformAction(
    c,
    "platform_email_changed",
    "user",
    user.id,
    { email: body.currentEmail },
    { email: body.newEmail },
  );
  return ok(c, { changed: true, email: updated.email });
});

/** POST /super/change-password — update the platform admin's own password. */
superAdminRoutes.post("/change-password", async (c) => {
  const user = c.get("user");
  if (!user) throw unauthorized();
  const body = parse(changePasswordInput, await c.req.json());
  await svc.changePlatformPassword(c.get("db"), user.id, body.currentPassword, body.newPassword);
  await auditPlatformAction(c, "platform_password_changed", "user", user.id, null, null);
  return ok(c, { changed: true });
});

superAdminRoutes.get("/backups", async (c) =>
  ok(c, {
    schedule: env.BACKUP_SCHEDULE,
    retention: {
      daily: env.BACKUP_RETENTION_DAILY,
      monthly: env.BACKUP_RETENTION_MONTHLY,
    },
    runs: await svc.listBackupJobs(c.get("db")),
  }),
);
