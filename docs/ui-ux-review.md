# UI and user-experience improvements

## Sign-in

- Web sign-in starts with empty fields instead of prefilled demo credentials.
- Account and password fields provide password-manager autocomplete hints.
- Password visibility can be toggled without submitting the form.
- Submission is disabled while required values are missing or a request is pending.
- Mobile keyboard Next moves from the account field to the password field; Go
  submits. Mobile login fields have accessible labels and errors are announced.

## Navigation

- Workspace sections are reflected in the URL fragment, such as `/#fees`.
  Refresh, browser Back/Forward, and language reloads retain the selected section.
- Restored sections are checked against the current user's allowed navigation.
- Authentication has a dedicated loading state before the workspace renders.
- Small-screen navigation hides its controls when closed, contains keyboard focus
  when open, handles Escape, locks page scrolling, and restores trigger focus.
- A skip link moves keyboard users directly to the main content.
- The account language selector is no longer nested inside a button.
- Notification panels fit narrow viewports and close on Escape.
- A hardcoded academic year/term label has been removed from the sidebar.

## Shared dialogs and controls

- Native modal dialogs make background content inert. Explicit Tab/Shift+Tab
  cycling keeps focus inside the dialog, including at the browser's tab boundary.
- Escape, backdrop clicks, unique accessible titles/descriptions, and focus
  restoration are supported. Parent handlers can prevent dismissal while saving.
- Dialogs fit their content up to the viewport limit instead of always occupying
  almost the entire screen. Long content scrolls inside the dialog body.
- Keyboard focus indicators are available across interactive elements; disabled
  inputs have a distinct appearance. Mobile form controls use readable font sizes.

## Finance journeys

### Family

`Invoices -> enabled payment option -> checkout or bank details -> proof upload -> submit -> success/review feedback`

- Responsive invoice cards show charges, payments, due dates, status, and balance
  without requiring horizontal scrolling on a phone.
- Only enabled school payment methods are offered. Cancelled invoices offer no
  new-payment actions and do not inflate displayed outstanding totals.
- Bank/QR instructions, account details, amount, reference, and proof upload are
  grouped in a labelled dialog. Submission waits for an in-progress proof upload.
- Success is a success message, not an error. Method-loading failures do not hide
  invoices that were loaded successfully.
- Gateway return parameters produce visible payment feedback and reopen Fees.
  Unconfirmed/cancelled payments advise checking the provider before paying again.

### Staff

`Invoices -> create or record payment -> validation -> saved feedback -> refreshed balance`

`Pending payment -> review details -> explicit approve/reject confirmation -> refreshed queue`

- Invoice creation, offline payment, bulk runs, approvals, and exports follow the
  supplied permissions. Read-only staff retain the staff invoice experience.
- Invoice and payment forms use visible labels, current-date defaults, appropriate
  amount limits, request-pending states, and inline errors.
- Loading, failed requests, no invoices, no matching filters, and no approvals
  have distinct states with refresh/retry or clear-filter actions where relevant.
- Student-selection failures can be retried without closing the invoice form.
- Approval/rejection has an explicit confirmation and optional review note.

## Verification

Verified using a production web build and headless Chrome with mocked API/upload
responses at mobile (390 × 844) and desktop (1440 × 900) dimensions:

- Empty login credentials, disabled submission, and password visibility.
- Finance viewport fit, enabled payment options, and cancelled-invoice guards.
- Dialog focus cycling, Escape, and focus restoration.
- Proof-upload pending state, submission payload, and success feedback.
- Mobile navigation focus, browser Back, refresh persistence, and notification fit.
- Gateway return feedback, invoice failure, and retry recovery.
- Invoice field labels/default date and confirmation before payment approval.
- No browser runtime errors in these flows.

Workspace typechecks, web/mobile lint, and the production web build were also run.
These browser checks do not validate live payment settlement, upload credentials,
real tenant permissions, or native Android/iOS rendering. Physical-device mobile
keyboard, screen-reader, and font-scaling checks remain useful follow-up coverage.
