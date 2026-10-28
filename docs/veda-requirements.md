# Veda-Style Student Management System Requirements

This is the persistent product baseline for the Nucleus Education Platform. The goal is a complete school/college ERP similar in breadth to Veda, delivered incrementally rather than as one oversized release.

## Product Principles

- Multi-tenant SaaS: each school, college, or academy has isolated students, staff, finance, academics, settings, branding, and reports.
- Separate role experiences: Super Admin, School Admin, Principal/Management, Teacher, Student, Parent/Guardian, Accountant, Reception, Librarian, Transport Manager, and HR/Admin.
- Responsive web administration plus one role-aware mobile app for students, parents, teachers, and staff.
- Configurable academic structures for schools, +2 colleges, and universities.
- Permission-controlled access with view, create, edit, delete, approve, export, and print actions.
- Sensitive data requires secure authentication, tenant filtering/RLS, audit trails, session expiry, rate limiting, brute-force protection, backups, and controlled document access.

## MVP Scope

Version 1 must cover:

1. Authentication, sessions, roles, permissions, and school setup.
2. Student profiles, guardians, teacher/staff profiles, admission basics, enrolment, promotion, transfer, withdrawal, and status management.
3. Academic years, terms/semesters, programmes/faculties, classes/grades, sections, subjects, subject groups, teacher assignments, classrooms, and academic calendar.
4. Daily, period, and subject attendance with present, absent, late, excused, sick, and official-leave states; corrections, leave requests, percentages, reports, alerts, and parent notifications.
5. Teacher management with assigned-class and assigned-subject scoping.
6. Weekly class, teacher, and room timetables with breaks, substitutes, availability, and conflict detection.
7. Assignments/homework: teacher creation, descriptions, attachments, deadlines, marks, online student submissions, feedback, and submitted/not-submitted/late tracking.
8. Examinations: setup, subjects, full/pass/practical/theory marks, weightage, teacher mark entry, approval/lock/publish workflow, remarks, and statistics.
9. Configurable percentage, letter-grade, GPA, CGPA, custom grading, report cards, marksheets, transcripts, rankings, attendance summaries, and print/PDF/Excel exports.
10. Fees and payments: configurable categories and structures, admission/tuition/exam/transport/library/hostel/lab/activity/custom fees, recurring periods, discounts, scholarships, invoices, balances, offline payments, receipts, dues, and financial reports.
11. Parent portal with multiple children and child switching; student portal with classes, attendance, assignments, exams, results, fees, notices, events, timetable, calendar, and profile.
12. Notices and in-app notifications targeted to school, grade, section, students, parents, teachers, or individuals; mobile notification support, with email/SMS adapters where configured.
13. Calendar and events, leave management, dashboards, basic management reports, branding, and system settings.

## Planned ERP Modules

Implement after the MVP unless explicitly prioritized:

- Online admissions: enquiries, applications, configurable forms, application fees, documents, entrance exams, interviews, scoring, approvals, offers, conversion, and reports.
- Library: books, categories, authors, ISBN/publisher, copies, shelves, issue/return, due dates, fines, lost books, history, and optional barcode/QR scanning.
- Transport: vehicles, drivers, routes, stops, student assignments, transport fees, and later GPS/live alerts.
- Hostel: buildings, floors, rooms, beds, allocations, wardens, fees, and check-in/check-out.
- HR and payroll: employee records, contracts, attendance, leave, documents, salary components, allowances, overtime, bonuses, deductions, taxes, provident fund, payslips, and reports.
- ID cards and certificates with configurable templates, photos, QR codes, school branding, transfer/bonafide/character/achievement/experience certificates.
- Advanced documents, alumni, scholarships, medical records, houses/groups, campus support, and graduation workflows.
- Payment gateways such as eSewa, Khalti, Fonepay, ConnectIPS, cards, and bank integrations; use hosted checkout and server-side verification.
- Subscription/package management for commercial SaaS plans and institution billing.
- Advanced analytics, WhatsApp, push-provider integrations, SSO, 2FA, and extensive automation.

## Core Workflows

### Student Lifecycle

`Enquiry -> Application -> Admission -> Enrolment -> Academic Progression -> Graduation / Transfer / Withdrawal`

Support promotion, section changes, subject changes, freeze/deactivation, transfer certificates, leaving records, and alumni history without destroying academic history.

### Academic Flow

`Academic Year -> Programme/Faculty -> Grade/Semester -> Section -> Subjects -> Teacher Assignment -> Attendance/Assignments/Exams -> Results`

### Finance Flow

`Fee Structure -> Invoice Run -> Invoice -> Payment -> Receipt -> Balance/Due Reports`

All payment mutations must be transactional, idempotent where applicable, permission-gated, auditable, and tenant-scoped.

### Communication Flow

Audience-targeted notices, exam publication, invoice generation, attendance/leave events, and account provisioning should create in-app notifications and use provider adapters for email, SMS, and push.

## Reporting Baseline

- Students by class, gender, admission, withdrawal, status, and demographics.
- Attendance daily, monthly, individual, class, teacher, term, and low-attendance reports.
- Results, grade distribution, subject performance, pass/fail, ranking, GPA/CGPA, and teacher performance.
- Fees collected, outstanding, daily/monthly collection, payment methods, discounts, scholarships, invoices, receipts, and refunds.
- Management dashboard with student/staff counts, present/absent counts, attendance, fee totals, outstanding balances, pass rate, enrolment, demographics, and trend charts.

## Definition Of Done

A feature is complete only when its role permissions, tenant isolation, API contract, validation, database behavior, web/mobile experience, notifications, reports/exports, audit behavior, tests, and documentation are addressed. The implementation must pass typecheck, lint, build, and relevant integration tests.
