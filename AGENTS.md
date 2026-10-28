# Project Requirements

The canonical product requirements for this repository are in `docs/veda-requirements.md`.

When implementing or reviewing features:

- Treat the Veda-style school/college ERP requirements as the product baseline.
- Prioritize the MVP scope before Phase 2 and Phase 3 modules.
- Preserve separate role experiences for Super Admin, School Admin, Management, Teacher, Student, Parent/Guardian, Accountant, Reception, Librarian, Transport, and HR users.
- Enforce tenant isolation, role-based permissions, scoped teacher access, secure authentication, and audit logging for every sensitive mutation.
- Do not mark a feature complete based only on database tables. Verify its API, permissions, web/mobile UI, validation, empty/error states, and relevant reports.
- Prefer configurable academic, grading, attendance, fee, notification, branding, and payment settings over hardcoded institution-specific behavior.
- Treat Library, Transport, Hostel, HR/Payroll, subscriptions, and advanced integrations as planned later phases unless the user explicitly prioritizes them.
