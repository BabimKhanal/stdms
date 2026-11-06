import { Hono } from "hono";
import type { AppEnv } from "../../lib/types";
import { ok } from "../../lib/http";
import { requireAdmin, requireAuth, requireOrg, requirePermission } from "../../middleware/guards";
import { schoolSetup } from "./setup";
import * as svc from "./service";
export const dashboardRoutes = new Hono<AppEnv>(); dashboardRoutes.use("*", requireAuth, requireOrg);
dashboardRoutes.get("/", requirePermission("organisation.view"), async (c) => ok(c, await svc.summary(c.get("db"), c.get("orgId")!, c.get("user")!)));
dashboardRoutes.get("/setup", requireAdmin, requirePermission("academic.view"), async (c) => ok(c, await schoolSetup(c.get("db"), c.get("orgId")!)));
