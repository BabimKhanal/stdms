# Architecture Notes

## Request Flow

`request-scope` verifies the access token, checks out one PostgreSQL connection, sets the tenant session variables, and binds Drizzle to that connection. The connection is discarded before returning to the pool, preventing tenant context leakage.

Routes are thin: authenticate, authorize, validate, call a service, return a response. Services contain business rules and explicit `organisation_id` filters. The database adds the second boundary through RLS policies.

## Tenant Security

The migration runner enables and forces RLS on tenant tables. A request with no tenant context sees no tenant rows. A platform administrator receives a narrowly-used platform GUC after its signed JWT has been verified. Login is the only unscoped read because the account must be found before its organisation is known.

## Data History

Student class placement belongs to `enrolments`, not the student profile. Promotion inserts a new academic-year row, preserving transcripts and previous class history.

## Portable Features

Features communicate through shared zod contracts and REST endpoints. The web app and future Expo app use the same API client contract; neither contains business logic that belongs in the backend.
