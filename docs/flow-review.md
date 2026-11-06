# Core flow review

This review focuses on verified API and build flaws in the student-document and
finance flows. It is not a completion assessment of every ERP module.

## Student document access

`Authenticated user -> tenant context -> document access guard -> student scope -> document`

The shared document middleware now rejects a missing student identifier before
using it for learner or teacher access checks. This also fixes the API TypeScript
build failure without weakening student, guardian, or teacher scoping.

## Online payment

`Invoice -> tenant-configured checkout -> eSewa -> public callback -> server verification -> locked invoice -> payment + balance + audit -> portal`

Fixed:

- The broad operations router intercepted payment callbacks with institution
  authentication. It now registers after the more specific module routers.
- eSewa v2 returns base64 JSON in `data`; callbacks now resolve that reference
  while retaining the legacy query parameter. Callback payloads do not establish
  payment success: the server still checks the gateway status, reference, and amount.
- Verification previously always called the sandbox. It now selects the official
  live or sandbox status endpoint from the configured checkout host, with a timeout.
- Payment completion checks the intent tenant, locks the invoice, and checks for
  an existing gateway reference before changing the ledger.
- Payment insertion, invoice balance update, and its audit entry share a transaction.
- The Redis intent remains available until its original 30-minute expiry so retries
  can return `already-completed`. Redirects use the first configured web origin
  rather than treating a comma-separated origin list as one URL.

## Manual payment, discounts, and refunds

`Permission check -> tenant-scoped record -> row lock -> current-state validation -> transactional writes`

- Payment, discount, refund, and gateway completion now lock the invoice before
  balance calculations, preventing stale read/modify/write updates.
- Submission review locks the submission before checking its pending status, then
  locks the invoice before approving payment. Repeated approval is rejected.
- Cancelled invoices reject new manual submissions, offline payments, payment
  approvals, gateway initiation, and discounts. Already-settled gateway payments
  remain subject to server verification and ledger recording.

## Invoice generation

`Fee structure lock -> distinct enrolled students -> existing-run check -> invoices + items`

Concurrent runs for the same structure serialize before checking existing invoices.
Distinct student selection avoids duplicate invoices from repeated placements.
Generated invoice numbers use UUIDs instead of millisecond timestamps that can
collide across concurrent runs for different structures.

## Verification coverage and follow-up

`apps/api/tests/payment-flows.test.ts` covers unauthenticated callback routing,
protected invoice routing, callback parsing, live/sandbox verification, rejection
of cancelled-invoice mutations, balance guards, repeated approval, retry handling,
and intent tenant mismatch. Database and gateway dependencies are mocked.

Real PostgreSQL concurrency, RLS integration, hosted checkout, and browser/mobile
payment journeys still need integration testing with disposable tenants and gateway
test credentials. The existing tenant-isolation suite requires explicit environment
configuration and is skipped by the default local test run.

Additional finance work remains: durable payment reconciliation after intent expiry,
an explicit overpayment/credit policy when payments settle through multiple channels,
exact decimal arithmetic, and idempotency keys for offline payment retries.
