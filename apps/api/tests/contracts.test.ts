import test from "node:test";
import assert from "node:assert/strict";
import { changePasswordSchema, loginSchema, passwordResetRequestSchema, passwordResetSchema } from "@edu/shared";
import { DEFAULT_ROLES } from "@edu/shared";

test("password reset contracts reject weak or incomplete input", () => {
  assert.equal(passwordResetRequestSchema.safeParse({ identifier: "ab" }).success, false);
  assert.equal(passwordResetSchema.safeParse({ token: "short", newPassword: "password" }).success, false);
  assert.equal(passwordResetSchema.safeParse({ token: "a".repeat(32), newPassword: "password123" }).success, true);
  assert.equal(changePasswordSchema.safeParse({ currentPassword: "secret", newPassword: "password123" }).success, true);
});

test("login accepts student identifiers", () => {
  assert.equal(loginSchema.safeParse({ identifier: "ST-1006", password: "Student@123" }).success, true);
});

test("student and parent roles have read access to learning and results", () => {
  assert.ok(DEFAULT_ROLES.student.permissions.includes("homework.view"));
  assert.ok(DEFAULT_ROLES.student.permissions.includes("result.view"));
  assert.ok(DEFAULT_ROLES.parent.permissions.includes("homework.view"));
  assert.ok(DEFAULT_ROLES.parent.permissions.includes("result.view"));
  assert.equal(DEFAULT_ROLES.student.permissions.includes("homework.create"), false);
});

test("student and parent roles can start payments", () => {
  assert.ok(DEFAULT_ROLES.student.permissions.includes("payment.view"));
  assert.ok(DEFAULT_ROLES.student.permissions.includes("payment.create"));
  assert.ok(DEFAULT_ROLES.parent.permissions.includes("payment.view"));
  assert.ok(DEFAULT_ROLES.parent.permissions.includes("payment.create"));
});
