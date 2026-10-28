# Architecture Notes

## Request Flow

`request-scope` verifies the access token, checks out one PostgreSQL connection, sets the tenant session variables, and binds Drizzle to that connection. The connection is discarded before returning to the pool, preventing tenant context leakage.

Routes are thin: authenticate, authorize, validate, call a service, return a response. Services contain business rules and explicit `organisation_id` filters. The database adds the second boundary through RLS policies.

## Tenant Security

The migration runner enables and forces RLS on tenant tables. A request with no tenant context sees no tenant rows. A platform administrator receives a narrowly-used platform GUC after its signed JWT has been verified. Login is the only unscoped read because the account must be found before its organisation is known.

## Data History

Student class placement belongs to `enrolments`, not the student profile. Promotion inserts a new academic-year row, preserving transcripts and previous class history.

## Results

`/exams/results` computes subject grades and GPA from the tenant's default grading scale (`grading_scales` + `grading_scale_bands`), the overall grade from the total percentage, and competition ranks inside the class and section. Only students enrolled in the exam's academic year are included, and rank is calculated against peers even when a learner requests their own row.

Exams are visible to learners only after `POST /exams/:id/publish` flips the status to `published`; publishing notifies affected students and guardians. `/exams/:id/report-card/:studentId` renders a printable HTML report card under the same learner scoping as results.

## Learner Access

Student and guardian logins are scoped to records they own:

- Students see only their own enrolment, attendance, homework, invoices, leave requests and published results for their class.
- Guardians see the same data for the children linked through `student_guardians`; a guardian with no linked children sees nothing rather than the whole institution.
- Staff keep the existing role and class/subject scoping.

Homework submissions are guarded by `homework.view` plus a student-profile check (`POST /homework/:id/submissions`). Students cannot create or edit assignments, and non-student accounts cannot submit on a learner's behalf.

## Portable Features

Features communicate through shared zod contracts and REST endpoints. The web app and future Expo app use the same API client contract; neither contains business logic that belongs in the backend.

## Password Recovery and Auditing

Password reset requests always return the same response whether an account exists. A matching active account receives a provider-backed email containing a Redis token with a 15-minute TTL. The token is deleted after one successful reset and all refresh sessions are revoked. `MAILER_PROVIDER=console` is suitable for local development; production should configure the Resend adapter and `PASSWORD_RESET_URL`.

Authenticated tenant mutations are recorded by the API mutation-audit middleware after the route completes. The row includes the HTTP action/path, actor, tenant, status, IP, and timestamp. Authentication lifecycle endpoints are excluded from tenant audit rows; password changes write their own audit entry.
