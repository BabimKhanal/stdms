CREATE TABLE "platform_email_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"singleton" text DEFAULT 'default' NOT NULL,
	"provider" text DEFAULT 'console' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"from_name" text NOT NULL,
	"from_email" text NOT NULL,
	"reply_to" text,
	"footer" text,
	"provider_domain" text,
	"smtp_host" text,
	"smtp_port" integer,
	"smtp_secure" boolean DEFAULT false NOT NULL,
	"smtp_username" text,
	"credentials_encrypted" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "platform_email_settings_singleton_uq" ON "platform_email_settings" USING btree ("singleton");
