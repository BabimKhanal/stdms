# Guided school setup

Institution owners, principals, and administrators with `academic.view` see a
Getting started checklist on Overview. Teacher, student, guardian, accountant,
and platform dashboards retain their own experiences.

## Flow

`Overview -> Continue setup -> Academic year -> Classes -> Sections -> Subjects -> Teaching assignments -> Overview`

The next action opens the exact academic substep, including after refresh or
browser Back/Forward:

- `/#academics/years`
- `/#academics/classes`
- `/#academics/sections`
- `/#academics/subjects`
- `/#academics/assignments`

Progress is derived from saved records, not local checkboxes or browser storage.
Saving academic records or teaching assignments refreshes guidance; returning to
Overview or choosing Check progress reads the current setup again. Failed reads
show a retry state instead of reporting zero progress.

Completed setup is labelled **Academic setup ready**, not whole-ERP completion.
Its detailed checklist is collapsed by default. Enrolment, timetables, grading,
fees, communication, and other operational configuration remain separate flows.

## Completion rules

| Step | Complete when |
| --- | --- |
| Current academic year | Exactly one year in the institution is marked current |
| Classes | At least one class exists |
| Sections | At least one section exists and every class has a section |
| Subjects | At least one subject exists |
| Subjects and teachers | Every class has a subject allocation; every allocation refers to a valid tenant class/subject and an active employee linked to an active Teacher or Class Teacher user |

Classes, sections and subject allocations are institution-wide in the existing
data model. This checklist does not invent academic-year ownership for them.
The section rule is the guided setup recommendation; it does not change existing
APIs that allow a student enrolment without a section.

The year guide can select an existing academic year as current, avoiding duplicate
year creation. Current-year creation/selection is transactional and serialized per
institution. A failed or missing target cannot clear the previous current year.

When no teacher accounts are available, teaching guidance links to Staff profiles
and User management according to view permissions. Teacher logins must be linked
to employee profiles and assigned the appropriate role before allocations count
as ready.

Student and attendance workspaces display a Set up academics notice for eligible
admins when the year, class, or section prerequisites are missing. The academic
structure view hides creation forms without `academic.create`, and checklist actions reflect
the supplied create/edit/user-view permissions. API permission checks remain
authoritative for mutations.

## API and isolation

`GET /api/v1/dashboard/setup` requires authentication, an institution context,
an administrator role, and `academic.view`. It returns current-year options,
step details, completed/total counts, readiness, and the next target.

The API uses the authenticated organisation, ignoring caller-supplied tenant IDs.
Its single SQL statement explicitly scopes every table, correlated subquery and
teacher-role lookup to that organisation. PostgreSQL RLS remains a second boundary.
The endpoint is read-only; existing academic mutation routes retain their audit
logging. No database migration is needed.

## Verification

`apps/api/tests/school-setup.test.ts` covers new/partial/ready institutions,
missing or multiple current years, section coverage, missing teacher assignments,
role/permission/tenant guards, tenant-bound query parameters, safe missing-year
class queries, and non-destructive handling of a missing year activation target.

Browser checks exercise the complete five-step creation journey with mocked API
responses, selecting an existing year, missing-teacher guidance, assignment save,
progress refresh, deep-link persistence, ready/error/retry states, and exclusion
of the teacher dashboard. The setup SQL was also exercised in a read-only
transaction against the configured PostgreSQL database using the application role
and tenant RLS context.
