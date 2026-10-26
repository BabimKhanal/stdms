import { z } from "zod";

export const loginSchema = z.object({
  /** email OR username OR student ID — the API figures out which one it is. */
  identifier: z.string().trim().min(3).max(200),
  password: z.string().min(6).max(200),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(6),
  newPassword: z.string().min(8).max(200),
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const sessionUserSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  email: z.string().nullable(),
  username: z.string().nullable(),
  orgId: z.uuid().nullable(),
  orgName: z.string().nullable(),
  isPlatformAdmin: z.boolean(),
  roles: z.array(z.string()),
  permissions: z.array(z.string()),
  mustChangePassword: z.boolean(),
  /** Present when the user is linked to a student record (student login). */
  studentId: z.uuid().nullable().optional(),
  /** Present when the user is linked to an employee record (teacher/staff login). */
  employeeId: z.uuid().nullable().optional(),
  /** Guardian IDs for parent logins — the API uses this to scope children. */
  guardianIds: z.array(z.uuid()).optional(),
  avatarUrl: z.string().nullable(),
  locale: z.string(),
});
export type SessionUser = z.infer<typeof sessionUserSchema>;

export const tokensSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresIn: z.number(),
});
export type Tokens = z.infer<typeof tokensSchema>;
