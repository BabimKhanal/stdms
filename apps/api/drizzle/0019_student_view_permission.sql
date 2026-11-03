INSERT INTO "permissions" ("resource", "action", "name")
VALUES ('student', 'view', 'student view')
ON CONFLICT ("resource", "action") DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
FROM "roles" r
JOIN "permissions" p
  ON p."resource" = 'student' AND p."action" = 'view'
WHERE r."key" = 'student'
ON CONFLICT DO NOTHING;
