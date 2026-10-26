import type { PoolClient } from "pg";
import type { DB } from "../db/client";

/** The authenticated principal for the current request. */
export type AuthUser = {
  id: string;
  name: string;
  orgId: string | null;
  isPlatformAdmin: boolean;
  /** e.g. ["owner", "teacher"] */
  roles: string[];
  /** e.g. ["student.view", "attendance.create"] */
  permissions: string[];
  mustChangePassword: boolean;
  /** Set when the login belongs to a student record. */
  studentId?: string | null;
  /** Set when the login belongs to an employee record (teacher/staff). */
  employeeId?: string | null;
  /** Guardian record IDs for parent logins. */
  guardianIds?: string[];
};

/** Hono context variables — every middleware/service can read these. */
export type AppVariables = {
  db: DB;
  client: PoolClient;
  user: AuthUser | null;
  orgId: string | null;
};
