# Adding A Module

Use `modules/academics` as the smallest CRUD example and `modules/students` as the joined-list example.

```text
shared schema → route validation → service(db, organisationId, input)
             → explicit tenant filter → Drizzle query → standard response
```

Keep names domain-based: `attendance_records`, `leave_requests`, and `fee_structure_items` explain their purpose without hidden framework conventions. Add a permission to `packages/shared/src/permissions.ts`, seed it, then use `requirePermission` in the route.
