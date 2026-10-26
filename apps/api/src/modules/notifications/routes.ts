import { Hono } from "hono";
import type { AppEnv } from "../../lib/types";
import { ok } from "../../lib/http";
import { requireAuth, requireOrg } from "../../middleware/guards";
import * as svc from "./service";

export const notificationRoutes = new Hono<AppEnv>();
notificationRoutes.use("*", requireAuth, requireOrg);

notificationRoutes.get("/", async (c) => ok(c, await svc.list(c.get("db"), c.get("orgId")!, c.get("user")!.id)));
notificationRoutes.get("/unread-count", async (c) => ok(c, { count: await svc.unreadCount(c.get("db"), c.get("orgId")!, c.get("user")!.id) }));
notificationRoutes.put("/:id/read", async (c) => ok(c, await svc.markRead(c.get("db"), c.get("orgId")!, c.get("user")!.id, c.req.param("id"))));
