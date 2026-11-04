import { and, eq, isNotNull } from "drizzle-orm";
import type { DB } from "./types";
import { platformEmailSettings, users } from "../db/schema";
import { env } from "../env";
import { buildMailConfig } from "./mail-config";
import { sendMail } from "./mailer";

type OperationAlert = {
  requestId: string;
  method: string;
  path: string;
  status: number;
  organisationId?: string | null;
  userId?: string | null;
  userName?: string | null;
  error?: string | null;
};

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[character] ?? character);
}

export async function alertPlatformAdmins(db: DB, alert: OperationAlert) {
  try {
    const recipients = await db
      .select({ email: users.email })
      .from(users)
      .where(and(eq(users.isPlatformAdmin, true), eq(users.status, "active"), isNotNull(users.email)));
    if (!recipients.length) return;
    const [storedSettings] = await db.select().from(platformEmailSettings).limit(1);
    const mailSettings = storedSettings ?? {
      provider: env.MAILER_PROVIDER,
      enabled: true,
      fromName: "Platform alerts",
      fromEmail: env.MAIL_FROM_EMAIL,
      replyTo: null,
      footer: null,
      providerDomain: null,
      smtpHost: null,
      smtpPort: null,
      smtpSecure: false,
      smtpUsername: null,
      credentialsEncrypted: null,
    };
    const mailConfig = buildMailConfig(mailSettings);
    const subject = `[Nucleus alert] ${alert.status} ${alert.method} ${alert.path}`;
    const rows = [
      ["Status", String(alert.status)],
      ["Request ID", alert.requestId],
      ["Method", alert.method],
      ["Path", alert.path],
      ["Organisation", alert.organisationId ?? "Platform / unauthenticated"],
      ["Actor", alert.userName ? `${alert.userName} (${alert.userId ?? "unknown"})` : alert.userId ?? "Unauthenticated"],
      ["Error", alert.error ?? "Request failed"],
    ];
    const html = `<h2>Failed API operation</h2><table>${rows.map(([label, value]) => `<tr><th align="left" style="padding:4px 16px 4px 0">${escapeHtml(label)}</th><td style="padding:4px 0">${escapeHtml(value)}</td></tr>`).join("")}</table>`;
    const text = rows.map(([label, value]) => `${label}: ${value}`).join("\n");
    await Promise.all(recipients.map(async ({ email }) => {
      if (!email) return;
      try {
        await sendMail({ to: email, subject, html, text }, mailConfig);
      } catch (error) {
        console.error(JSON.stringify({ event: "operation_alert_email_failed", email, error: error instanceof Error ? error.message : "Email delivery failed" }));
      }
    }));
  } catch (error) {
    console.error(JSON.stringify({ event: "operation_alert_failed", error: error instanceof Error ? error.message : "Unable to create operation alert" }));
  }
}
