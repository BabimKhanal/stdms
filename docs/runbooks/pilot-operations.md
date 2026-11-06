# Pilot Operations Runbook

## Release gate

Every deployment commit must pass `npm run ci`. Protect the deployment branch so the `CI / verify` check is required. Database migrations run before the API process starts and must first be rehearsed against a production-like backup.

The CI security gate audits deployed API/web production dependencies. Audit the Expo/EAS toolchain separately before each store release; do not force an incompatible Expo downgrade to silence toolchain findings. Record accepted mobile build-tool findings and remove them during the next supported Expo SDK/EAS upgrade.

## Health and alerting

- `GET /live` proves the API process can serve HTTP. It must not query dependencies.
- `GET /ready` checks PostgreSQL and Redis with bounded timeouts. A `503` removes the instance from service.
- Alert the operator after two consecutive readiness failures, a sustained 5xx rate above 2%, or any payment callback failure.
- Use the `x-request-id` response header to correlate client reports with structured `http_request` logs.

## Backups

- PostgreSQL: daily encrypted full backup plus provider point-in-time recovery where available.
- Uploaded documents: enable Cloudinary backup/version retention or export originals to institution-controlled storage.
- Retention: 35 daily backups and 12 monthly backups for the pilot, subject to the institution's retention agreement.
- Target RPO: 24 hours without PITR, 15 minutes with PITR. Target RTO: 4 hours.
- Backup success must alert an accountable operator; a backup that has not been restored is not considered verified.

### Render and Cloudflare R2 setup

The Render Blueprint defines a daily 02:00 UTC Docker Cron job with PostgreSQL 18 `pg_dump`, AES-256-GCM client-side encryption, and 35 daily plus 12 monthly restore points. It uploads the encrypted custom-format dump and a decryption manifest to the `database/` prefix of a dedicated S3-compatible bucket.

1. Create a private Cloudflare R2 bucket and an access key limited to that bucket.
2. Set `BACKUP_DATABASE_URL` on the Cron service to the direct Neon PostgreSQL URL with a role that can dump the complete database. Do not use the transaction pooler URL.
3. Set `BACKUP_S3_ENDPOINT`, `BACKUP_S3_BUCKET`, `BACKUP_S3_ACCESS_KEY_ID`, and `BACKUP_S3_SECRET_ACCESS_KEY` on the Cron service.
4. Preserve the generated `BACKUP_ENCRYPTION_KEY` in an approved secrets vault. It is required to decrypt backups after moving the runner to a VPS; never store it in the database or commit it.
5. Configure `BACKUP_ALERT_WEBHOOK_URL` to an operator-owned endpoint that accepts JSON run events.
6. Validate local or VPS settings without connecting to the database using `npm run db:backup:check -w @edu/api`.
7. Deploy the migration and Blueprint, inspect the first Cron run, and verify the encrypted object and manifest exist in R2.
8. Complete an isolated restore drill before treating backups as production-ready. During a VPS move, reuse the same storage prefix, key, database history, and schedule intent; replace only the Render Cron runner.

## Restore drill

Run before the first pilot and quarterly:

1. Create an isolated PostgreSQL instance with no production network access.
2. Restore the latest full backup and replay PITR logs to the selected recovery time.
3. Apply pending migrations using `npm run db:migrate`.
4. Start PostgreSQL, Redis, and the API with isolated credentials.
5. Confirm `/ready` returns `200`.
6. Verify tenant counts, one student history, one invoice/receipt, one published result, and one audit trail per sampled tenant.
7. Record backup timestamp, restore duration, data checks, operator, and any variance from RPO/RTO.
8. Destroy the isolated environment and rotate any temporary credentials.

## Deployment and rollback

1. Announce the maintenance window and capture a pre-deploy backup.
2. Run CI and migration rehearsal against a restored copy.
3. Deploy migrations, then application instances.
4. Verify `/live`, `/ready`, login, tenant isolation, student listing, attendance, invoice receipt, and notification delivery.
5. For application-only failure, roll back the application image.
6. Never automatically reverse a destructive migration. Roll forward from backup/rehearsed scripts or restore under incident command.

## Incident handling

- Severity 1: tenant data exposure, unreconciled payment mutation, total outage, or unrecoverable data loss. Disable affected flows, preserve logs, notify the accountable operator immediately, and begin the breach/payment runbook.
- Severity 2: major role workflow unavailable without data loss. Respond within one hour during the pilot window.
- Rotate JWT, database, Redis, mail, Cloudinary, and gateway credentials after suspected compromise. JWT rotation signs out all users.

## Go-live evidence

- Required CI check passed on the deployed commit.
- Tenant-isolation integration suite passed against a disposable environment.
- Restore drill met the agreed RPO/RTO.
- Production mail and password reset were verified.
- Payment initiate, verify, replay rejection, receipt, and reconciliation were verified if payments are enabled.
- Named owners exist for alerts, incidents, school support, and data requests.
