import { env } from "../env";

type MailInput = { to: string; subject: string; html: string };

/** Provider boundary for transactional email. Console mode keeps local/demo flows usable. */
export async function sendMail(input: MailInput): Promise<void> {
  if (env.MAILER_PROVIDER === "resend") {
    if (!env.RESEND_API_KEY) throw new Error("RESEND_API_KEY is required when MAILER_PROVIDER=resend");
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: env.MAIL_FROM, to: [input.to], subject: input.subject, html: input.html }),
    });
    if (!response.ok) throw new Error(`Email provider rejected the message (${response.status})`);
    return;
  }
  console.info(`[mailer:console] to=${input.to} subject=${input.subject}\n${input.html}`);
}
