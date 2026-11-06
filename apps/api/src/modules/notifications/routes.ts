import { Hono } from "hono";
import type { AppEnv } from "../../lib/types";
import { ok } from "../../lib/http";
import { requireAuth, requireOrg } from "../../middleware/guards";
import * as svc from "./service";
import { z } from "zod";
import { parse } from "../../lib/http";

export const notificationRoutes = new Hono<AppEnv>();
notificationRoutes.use("*", requireAuth, requireOrg);

notificationRoutes.get("/", async (c) =>
  ok(c, await svc.list(c.get("db"), c.get("orgId")!, c.get("user")!.id)),
);
notificationRoutes.get("/unread-count", async (c) =>
  ok(c, {
    count: await svc.unreadCount(
      c.get("db"),
      c.get("orgId")!,
      c.get("user")!.id,
    ),
  }),
);
notificationRoutes.put("/:id/read", async (c) =>
  ok(
    c,
    await svc.markRead(
      c.get("db"),
      c.get("orgId")!,
      c.get("user")!.id,
      c.req.param("id"),
    ),
  ),
);
const pushTokenInput = z.object({
  token: z
    .string()
    .trim()
    .regex(/^(?:Exponent|Expo)PushToken\[[^\]\r\n]{10,480}\]$/),
  platform: z.enum(["ios", "android", "web", "unknown"]).default("unknown"),
});
notificationRoutes.post("/push-tokens", async (c) => {
  const input = parse(pushTokenInput, await c.req.json());
  return ok(
    c,
    await svc.registerPushToken(
      c.get("db"),
      c.get("orgId")!,
      c.get("user")!.id,
      input.token,
      input.platform,
    ),
    201,
  );
});
notificationRoutes.delete("/push-tokens", async (c) => {
  const input = parse(pushTokenInput.pick({ token: true }), await c.req.json());
  return ok(
    c,
    await svc.revokePushToken(
      c.get("db"),
      c.get("orgId")!,
      c.get("user")!.id,
      input.token,
    ),
  );
});
