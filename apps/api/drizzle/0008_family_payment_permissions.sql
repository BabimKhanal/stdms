INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
FROM "roles" r
JOIN "permissions" p ON p."resource" = 'payment' AND p."action" IN ('view', 'create')
WHERE r."key" IN ('student', 'parent', 'guardian')
ON CONFLICT DO NOTHING;
