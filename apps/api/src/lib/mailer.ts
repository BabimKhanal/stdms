import { env } from "../env";

export type MailConfig = {
  provider?: "console" | "resend";
  enabled?: boolean;
  fromName?: string;
  fromEmail?: string;
  replyTo?: string | null;
  footer?: string | null;
};
type MailInput = { to: string; subject: string; html: string };

/** Provider boundary for transactional email. Console mode keeps local/demo flows usable. */
export async function sendMail(input: MailInput, config: MailConfig = {}): Promise<void> {
  if (config.enabled === false) return;
  const provider = config.provider ?? env.MAILER_PROVIDER;
  if (provider === "resend") {
    if (!env.RESEND_API_KEY) throw new Error("RESEND_API_KEY is required when MAILER_PROVIDER=resend");
    const from = config.fromName && config.fromEmail
      ? `${config.fromName} <${config.fromEmail}>`
      : env.MAIL_FROM;
    const html = config.footer ? `${input.html}<hr /><p>${config.footer}</p>` : input.html;
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [input.to], subject: input.subject, html, ...(config.replyTo ? { reply_to: config.replyTo } : {}) }),
    });
    if (!response.ok) throw new Error(`Email provider rejected the message (${response.status})`);
    return;
  }
  console.info(`[mailer:console] to=${input.to} subject=${input.subject}\n${input.html}`);
}
