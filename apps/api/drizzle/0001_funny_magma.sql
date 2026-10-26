DROP INDEX "users_org_email_uq";--> statement-breakpoint
DROP INDEX "users_org_username_uq";--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_uq" ON "users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "users_username_uq" ON "users" USING btree ("username");