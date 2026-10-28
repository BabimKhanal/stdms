# Nucleus Education Platform

A multi-tenant school and college MIS foundation built to be easy to read, extend, and teach.

## Stack

- Web: Next.js 16, React, TypeScript, Tailwind CSS v4, shadcn-style UI components
- API: Hono, TypeScript, Drizzle ORM
- Data: PostgreSQL 18 with genuine Row Level Security, Redis
- Workspace: npm workspaces + Turborepo
- Mobile: Expo app reserved at `apps/mobile` for the next delivery slice

## Run Locally

PostgreSQL and Redis must be running.

```powershell
npm install
Copy-Item apps/api/.env.example apps/api/.env
npm run db:setup
npm run dev
```

Web: `http://localhost:3000`  
API health: `http://localhost:4000/health`

The seed creates Greenwood Academy with students, guardians, staff, classes, attendance, leave, homework, fees, exams, notices, and demo accounts. The seed output prints the credentials.

## Architecture

```text
Next.js web ─┐
             ├── REST /api/v1 ── Hono ── Drizzle ── PostgreSQL
Expo mobile ─┘                         └──────────── Redis
```

Every tenant business table has `organisation_id`. The API explicitly filters every service query by the active organisation, and PostgreSQL RLS independently enforces the same boundary using `app.current_org_id`. The runtime role `edu_app` does not own the tables, so RLS is active in normal requests.

## Demo Roles

The seed includes platform admin, owner, principal, administrator, teacher, accountant, exam officer, student, and parent accounts. Use `owner@greenwood.edu.np` / `Owner@123` to explore the institution portal.

## Add A Module

1. Add a table to the appropriate file in `apps/api/src/db/schema`.
2. Run `npm run db:generate -w @edu/api`.
3. Add `service.ts` functions with `(db, organisationId, ...)` parameters and explicit tenant filters.
4. Add `routes.ts` with zod parsing, permission middleware, and the standard `{ ok, data }` response.
5. Register the router in `apps/api/src/app.ts`.
6. Add shared input schemas in `packages/shared` and a web screen using `components/ui`.
7. Run the three typechecks and the web build.

## Tests

Run the fast contract and permission tests with:

```powershell
npm run test
```

The cross-tenant integration test is opt-in. Configure a disposable database
with two seeded owner accounts, then set `RUN_INTEGRATION_TESTS=1`,
`TEST_TENANT_A_IDENTIFIER`, `TEST_TENANT_A_PASSWORD`,
`TEST_TENANT_B_IDENTIFIER`, and `TEST_TENANT_B_PASSWORD` before running the
test command. It verifies that tenant A cannot read tenant B students,
invoices, or homework.

The same module shape is intentionally used everywhere so students can learn one feature from top to bottom and reuse it.
# stdms
