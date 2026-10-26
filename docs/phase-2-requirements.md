# Phase 2 Requirements — Nucleus Education Platform

Status: draft for review · Derived from a code review of `apps/api`, `apps/web`, `packages/shared` (October 2026)

---

## 1. Current System Flow (as built)

```text
Next.js web portal ─┐
                    ├── REST /api/v1 ── Hono ── request-scope ── Drizzle ── PostgreSQL (RLS)
Expo mobile (TBD) ─┘         │                    │
                    WebSocket /ws/notifications ─┘ └── Redis (sessions)
```

### 1.1 Request lifecycle (verified in code)

1. **Auth** — `apps/api/src/modules/auth` issues a short-lived JWT access token plus a refresh token of the form `<userId>.<secret>`, stored in Redis with a 7-day TTL and rotated on every use (`auth/routes.ts` → `refreshSession`). Login accepts email, username, or student code. Accounts carry `mustChangePassword`.
2. **Tenant scoping** — `middleware/request-scope.ts` verifies the token, checks out **one** PostgreSQL connection per request, sets the RLS session variable `app.current_org_id`, and binds Drizzle to that connection. The connection is discarded on response, so tenant context cannot leak through the pool. Platform admins get a separate, narrowly-used platform GUC.
3. **Authorization** — every route declares `requireAuth`, `requireOrg`, and `requirePermission("x.y")` guards built from role permissions loaded via `userRoles → rolePermissions`.
4. **Services** — plain functions `(db, organisationId, …)` with explicit `organisation_id` filters (`tenant()` helper). PostgreSQL RLS is the second, independent boundary.
5. **Contracts** — zod schemas live in `packages/shared/src/schemas` and are shared by API parsing and web forms.

### 1.2 Delivered modules

| Module | Tables (schema file) | Notables |
|---|---|---|
| Academics | `academicYears, terms, classes, sections, subjects, classSubjects, enrolments, timetablePeriods, timetableSlots` | History-preserving enrolments; timetable periods/slots |
| Students | `students, guardians, studentGuardians, employees` | Guardian linking; provisioning of student/guardian portal accounts (`mustChangePassword: true`) |
| Operations | `attendanceRecords, leaveRequests, homework, homeworkSubmissions, notices, noticeAudiences, events` | Homework/attachment support; notices + events create in-app notifications and WS fan-out |
| Exams | `exams, examSubjects, marks, gradingScales, gradingScaleBands` | Mark entry with class-teacher scoping (`scoped-results.ts`); scales stored but **not yet applied** |
| Fees | `feeCategories, feeStructures, feeStructureItems, invoices, invoiceItems, payments, discounts` | Manual/offline payment recording only |
| Platform | `organisations, users, roles, rolePermissions, userRoles, permissions, auditLogs, featureFlags` | Branding settings, audit log viewer |
| System | `files, notifications, pushTokens` | Cloudinary uploads; WebSocket notification push (`/ws/notifications`) |

Web portal (`apps/web/components/portal.tsx`) sections: dashboard, students, guardians, academics, attendance, fees, exams, learning, users, branding. Remaining nav entries render `PlaceholderView`.

### 1.3 Observed gaps (these drive Phase 2)

1. **Results are incomplete** — `resultRows()` returns `grade: null, gpa: null, rank: null`; the grading scale tables exist but no code applies them.
2. **Fees are offline-only** — payments are recorded by an accountant; no online collection, no receipt generation, no term-wise invoice run.
3. **No outbound communication** — email/SMS never send; temporary passwords are only printed by the seed script; notification is in-app + WS only (`pushTokens` table is unused).
4. **List endpoints are unpaginated** — nearly every route hardcodes `okList(c, rows, rows?.length, 1, 1000)`; no search, filter, or cursor contract on most modules.
5. **Audit logging is read-only** — `listAudit()` exists in `organisation/service.ts`, but mutations do not write `auditLogs`.
6. **Zero automated tests** — no test files across the repo; the only checks are `tsc --noEmit` and the web build.
7. **No auth hardening** — no rate limiting on login/refresh, no password-reset flow.
8. **Mobile is empty** — `apps/mobile` is reserved but has no slice.
9. Placeholder portal sections (library, transport, HR) — **deferred to Phase 3 by design**.

---

## 2. Phase 2 Goal

> **Make the platform production-credible for one institution:** complete the exam result and fees workflows end-to-end, add outbound communication, harden the platform, and establish a test baseline — while reuse-grade mobile APIs become a free byproduct of completing those endpoints, with a thin Expo slice as proof.

Non-goals (explicitly out of Phase 2): library, transport, HR/payroll, timetabling conflict solver, multi-currency, second-tenant onboarding UX, SSO.

---

## 3. Workstream A — Exams & results completion

| ID | Requirement | Priority |
|---|---|---|
| A1 | Apply the tenant's grading scale to computed results: return `grade`, `gpa`, and per-band resolution from `gradingScaleBands` on every result row; scale selection per exam, falling back to the tenant default. | Must |
| A2 | Compute and expose class rank, section rank, total/percentage, and pass/fail roll-up on the existing `/exams/results` response (no new table required; keep the computation in the service layer). | Must |
| A3 | Exam publishing workflow: `status: draft → published` transition endpoint with permission gate; publish is irreversible in Phase 2 and triggers a notification to affected students/guardians via the existing notification service. | Must |
| A4 | Report-card export: server-rendered printable per-student report card (HTML print view) driven by existing result query + exam metadata. | Should |
| A5 | Rewrite `resultRows()` mark loading from the current in-memory `find()` joins to explicit SQL joins/aggregation (correctness identical; behavior verified against large seed classes). | Should |

**Acceptance:** a principal can open an exam, publish it, and every student/parent sees graded results with GPA, grade, and rank; a student sees only their own row (already enforced by `scopedResultRows`, keep under test).

## 4. Workstream B — Fees & payments

| ID | Requirement | Priority |
|---|---|---|
| B1 | Invoice run: generate invoices in bulk for a class/section from a fee structure for a term (one endpoint + DB-level transaction); idempotent per (student, term, structure). | Must |
| B2 | Receipt endpoint: printable HTML receipt (invoice + payments + discounts) permission-gated; web opens it in a new tab. | Must |
| B3 | Online payment: hosted-checkout integration so guardians can pay an invoice from the fees screen. **Decision gate:** Nepali gateways (eSewa / Khalti / Fonepay) are not in the integration catalog and need direct REST integration; pick one gateway, implement its initiate → redirect → verify → record-payment flow server-side, storing gateway refs on `payments` (new columns: `method`, `gatewayRef`, `verifiedAt`). | Should |
| B4 | Due-date handling: overdue computation in fee summary + optional overdue filter on invoice list. | Should |
| B5 | Guardians' payment UX: the guardian view shows own students' invoices, balance, and (if B3 ships) a "Pay now" button with the tenant-visible gateway label. | Should |

**Acceptance:** as owner, run an invoice generation for a class → invoices appear immediately; as guardian, see an invoice and either record an offline payment (accountant) or complete a gateway payment that flips the invoice to paid and files a receipt.

## 5. Workstream C — Outbound communication

| ID | Requirement | Priority |
|---|---|---|
| C1 | Email provider integration behind a `lib/mailer.ts` adapter (candidates to evaluate at implementation: Knock — notification orchestration w/ 10k msgs/mo free tier —, Resend, Postmark; per-tenant sender identity if trivial) since no tenant has SMTP today. | Must |
| C2 | Password reset: request → email reset link → reset endpoint (single-use token in Redis, 15-min TTL); also honor `mustChangePassword` on first login (already flag exists; enforce in web). | Must |
| C3 | Transactional notifications: notify audiences (students, guardians, staff, all) on notice/event creation, exam publication, invoice generation, and password provisioning — replacing today's "temporary password printed to console" path with an email when an email exists. | Must |
| C4 | Provider-abstracted SMS/push scaffold: define the adapter interface + DB columns, wire `pushTokens` registration endpoint (mobile ready), defer actual SMS vendor to Phase 3. | Could |

**Acceptance:** creating a notice emails (or queues email for) opted-in audiences; a user who forgot a password can self-reset end-to-end without an admin.

## 6. Workstream D — Platform hardening & quality

| ID | Requirement | Priority |
|---|---|---|
| D1 | Pagination contract: `okList` gains standard `?page|?limit|?search|?sort` handling with bounded limits, applied to list routes module-by-module (students, guardians, invoices, exams first); web lists follow. | Must |
| D2 | Audit writing: shared `recordAudit(db, orgId, userId, action, entity, entityId, diff?)` called from mutating service functions (users, roles, fees, exams, students) — the table and viewer already exist; only writes are missing. | Must |
| D3 | Rate limiting on `/auth/*` (Redis-backed sliding window per IP + per identity) and lockout after N failed logins per identifier. | Must |
| D4 | Test baseline: API integration tests (Hono `app.request`) covering auth/session rotation, tenant isolation (cross-org reads return zero rows), exams results math, fees invoice/payment math, permissions matrix; shared zod schema unit tests. Target: every module's happy path + at least one tenant-isolation case per module. | Must |
| D5 | Refresh-token robustness: rejected replay of a rotated token invalidates the session family (detect reuse of already-rotated tokens), verified by test. | Should |
| D6 | Feature flags: enforce `featureFlags` reads in the two workstreams that need it (online payments, grade publishing) so tenant rollout can be gated without deploys. | Could |

**Acceptance:** `npm run typecheck` + `turbo test` green in CI-equivalent local run; a script proving `user A (org 1)` cannot read org 2's students, invoices, or results even with a forged `orgId` header (RLS + service filter both exercised).

## 7. Workstream E — Mobile proof slice (Expo)

| ID | Requirement | Priority |
|---|---|---|
| E1 | `apps/mobile` boots with Expo + API client sharing `packages/shared` contracts and the token-pair storage/refresh pattern used in web (`lib/api` analog). | Should |
| E2 | One end-to-end flow per principal type: **student** — login, see homework list, mark as read; **guardian** — login, see children's attendance % and fee balance; notification list with WS reconnection fallback to polling. | Should |

**Acceptance:** on iOS/Android emulator, a seeded guardian logs in and sees real attendance + fee numbers from the live API within the same build.

---

## 8. Delivery order & dependencies

```text
D4 (tests first) ──► A1..A5 (results) ──► B1/B2 (invoice run + receipts) ──► B3 (gateway) ──► E2
      │                                                   ▲
      └──► D1/D2/D3 (hardening) ──► C1/C2/C3 (comms) ─────┘
```

Suggested milestones:
1. **M1 — Safety net:** D4 + D1 (lists) + D2 (audit) landed.
2. **M2 — Results done:** A1–A3 ship behind a flag; A4/A5 as capacity allows.
3. **M3 — Money & message:** B1/B2 + C1/C2/C3; B3 pending gateway decision.
4. **M4 — Mobile proof:** E1/E2 on top of stable endpoints.

---

## 9. Open decisions for review

| # | Decision | Options | Default proposal |
|---|---|---|---|
| 1 | Payment gateway | eSewa, Khalti, Fonepay (all need direct REST; none in catalog) | Start with eSewa (docs + sandbox) |
| 2 | Email provider | Knock (orchestrates email+SMS+push; free 10k/mo), Resend, Postmark | Decide during C1 spike; adapter keeps it swappable |
| 3 | GPA formula | Percent-weighted GPA vs Nepal PLE-style grading | Follow tenant's configured `gradingScales` as source of truth; document formula in `docs/` |
| 4 | Report card format | HTML print view vs server-side PDF | HTML print view in Phase 2; PDF if a school demands it |
| 5 | Scope of E2 flows | Student-only vs student+guardian | Student + guardian |

---

## 10. Definition of done (phase exit)

- All **Must** requirements across A–D shipped and verified by tests written under D4.
- A5, B3, B4, B5, C4, D5, D6, E1, E2 shipped **or** explicitly descoped with a note in this doc's changelog.
- Zero cross-tenant data access demonstrable by test.
- `docs/architecture.md` updated where this phase changes the flow (payments callback, mailer, pagination contract).
