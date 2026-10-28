ALTER TABLE "payments" ADD COLUMN "gateway_ref" text;
ALTER TABLE "payments" ADD COLUMN "verified_at" timestamp with time zone;
CREATE UNIQUE INDEX "payments_gateway_ref_uq" ON "payments" USING btree ("gateway_ref");
