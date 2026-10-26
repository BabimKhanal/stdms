import { Hono } from "hono";
import { cors } from "hono/cors";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { env } from "./env";
import { requestScope } from "./middleware/request-scope";
import { authRoutes } from "./modules/auth/routes";
import { academicRoutes } from "./modules/academics/routes";
import { enrolmentRoutes, guardianRoutes, studentRoutes } from "./modules/students/routes";
import { operationRoutes } from "./modules/operations/routes";
import { feeRoutes } from "./modules/fees/routes";
import { examRoutes } from "./modules/exams/routes";
import { reportRoutes } from "./modules/reports/routes";
import { dashboardRoutes } from "./modules/dashboard/routes";
import { organisationRoutes } from "./modules/organisation/routes";
import { userRoutes, roleRoutes } from "./modules/users/routes";
import { superAdminRoutes } from "./modules/super-admin/routes";
import { uploadRoutes } from "./modules/uploads/routes";
import { notificationRoutes } from "./modules/notifications/routes";
import type { AppEnv } from "./lib/types";

export const app = new Hono<AppEnv>();

const configuredWebOrigins = env.WEB_ORIGIN.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  "*",
  cors({
    origin: [
      ...configuredWebOrigins,
      "http://localhost:3000",
      "http://localhost:8081",
      "http://127.0.0.1:8081",
      "http://localhost:19006",
    ],
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  }),
);

// Every request gets a scoped DB connection + RLS session GUCs.
app.use("*", requestScope);

app.get("/health", (c) => c.json({ ok: true, service: "edu-api", time: new Date().toISOString() }));

app.route("/api/v1/auth", authRoutes);
app.route("/api/v1/uploads", uploadRoutes);
app.route("/api/v1/academics", academicRoutes);
app.route("/api/v1/students", studentRoutes);
app.route("/api/v1/guardians", guardianRoutes);
app.route("/api/v1/enrolments", enrolmentRoutes);
// Register platform routes before the broad operations router. The operations
// router has an institution-context guard; platform admins intentionally do not.
app.route("/api/v1/super", superAdminRoutes);
app.route("/api/v1", operationRoutes);
app.route("/api/v1/fees", feeRoutes);
app.route("/api/v1/exams", examRoutes);
app.route("/api/v1/reports", reportRoutes);
app.route("/api/v1/dashboard", dashboardRoutes);
app.route("/api/v1/organisation", organisationRoutes);
app.route("/api/v1/users", userRoutes);
app.route("/api/v1/roles", roleRoutes);
app.route("/api/v1/notifications", notificationRoutes);

app.notFound((c) => c.json({ ok: false, error: `Not found: ${c.req.path}` }, 404));

app.onError((err, c) => {
  const status = ((err as { status?: number }).status ?? 500) as ContentfulStatusCode;
  if (status >= 500) console.error("[api]", err);
  return c.json(
    { ok: false, error: err.message || "Internal server error", code: (err as { code?: string }).code },
    status,
  );
});
