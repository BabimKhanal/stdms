import nodemailer from "nodemailer";
import { env } from "../env";

export type MailProvider = "console" | "resend" | "sendgrid" | "mailgun" | "smtp";

export type MailConfig = {
  provider?: MailProvider;
  enabled?: boolean;
  fromName?: string;
  fromEmail?: string;
  replyTo?: string | null;
  footer?: string | null;
  apiKey?: string | null;
  providerDomain?: string | null;
  smtp?: {
    host?: string | null;
    port?: number | null;
    secure?: boolean;
    username?: string | null;
    password?: string | null;
  };
};

export type MailInput = { to: string; subject: string; html: string; text?: string };

function sender(config: MailConfig) {
  return config.fromName && config.fromEmail ? `${config.fromName} <${config.fromEmail}>` : env.MAIL_FROM;
}

function body(input: MailInput, config: MailConfig) {
  return config.footer ? `${input.html}<hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0" /><p style="color:#64748b;font-size:12px">${config.footer}</p>` : input.html;
}

async function postJson(url: string, headers: Record<string, string>, payload: unknown) {
  const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(payload) });
  if (!response.ok) {
    const detail = (await response.text().catch(() => "")).slice(0, 500);
    throw new Error(`Email provider rejected the message (${response.status})${detail ? `: ${detail}` : ""}`);
  }
}

/** Provider boundary for transactional and bulk email. */
export async function sendMail(input: MailInput, config: MailConfig = {}): Promise<void> {
  if (config.enabled === false) return;
  const provider = config.provider ?? env.MAILER_PROVIDER;
  const html = body(input, config);

  if (provider === "resend") {
    const apiKey = config.apiKey || env.RESEND_API_KEY;
    if (!apiKey) throw new Error("A Resend API key is required when the Resend provider is enabled");
    await postJson("https://api.resend.com/emails", { Authorization: `Bearer ${apiKey}` }, {
      from: sender(config),
      to: [input.to],
      subject: input.subject,
      html,
      ...(input.text ? { text: input.text } : {}),
      ...(config.replyTo ? { reply_to: config.replyTo } : {}),
    });
    return;
  }

  if (provider === "sendgrid") {
    const apiKey = config.apiKey || env.SENDGRID_API_KEY;
    if (!apiKey) throw new Error("A SendGrid API key is required when the SendGrid provider is enabled");
    await postJson("https://api.sendgrid.com/v3/mail/send", { Authorization: `Bearer ${apiKey}` }, {
      personalizations: [{ to: [{ email: input.to }] }],
      from: { email: config.fromEmail || env.MAIL_FROM_EMAIL, name: config.fromName || undefined },
      ...(config.replyTo ? { reply_to: { email: config.replyTo } } : {}),
      subject: input.subject,
      content: [
        ...(input.text ? [{ type: "text/plain", value: input.text }] : []),
        { type: "text/html", value: html },
      ],
    });
    return;
  }

  if (provider === "mailgun") {
    const apiKey = config.apiKey || env.MAILGUN_API_KEY;
    const domain = config.providerDomain || env.MAILGUN_DOMAIN;
    if (!apiKey || !domain) throw new Error("Mailgun requires an API key and a sending domain");
    const form = new FormData();
    form.set("from", sender(config));
    form.set("to", input.to);
    form.set("subject", input.subject);
    form.set("html", html);
    if (input.text) form.set("text", input.text);
    if (config.replyTo) form.set("h:Reply-To", config.replyTo);
    const response = await fetch(`https://api.mailgun.net/v3/${encodeURIComponent(domain)}/messages`, {
      method: "POST",
      headers: { Authorization: `Basic ${Buffer.from(`api:${apiKey}`).toString("base64")}` },
      body: form,
    });
    if (!response.ok) throw new Error(`Email provider rejected the message (${response.status})`);
    return;
  }

  if (provider === "smtp") {
    const host = config.smtp?.host;
    const port = config.smtp?.port;
    if (!host || !port) throw new Error("SMTP requires a host and port");
    // Port 587 negotiates STARTTLS after connecting; port 465 uses implicit TLS.
    const secure = port === 465 ? true : port === 587 ? false : config.smtp?.secure ?? false;
    const transport = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: config.smtp?.username && config.smtp?.password ? { user: config.smtp.username, pass: config.smtp.password } : undefined,
    });
    try {
      await transport.sendMail({
        from: sender(config),
        to: input.to,
        subject: input.subject,
        html,
        text: input.text,
        replyTo: config.replyTo ?? undefined,
      });
    } catch (error) {
      const code = (error as { code?: string; responseCode?: number }).code;
      const responseCode = (error as { responseCode?: number }).responseCode;
      if (responseCode === 535 || code === "EAUTH") {
        throw new Error("SMTP authentication failed. Check the username/password; Gmail accounts must use an App Password, not the normal account password.");
      }
      if (code === "ETIMEDOUT" || code === "ESOCKET" || code === "ECONNREFUSED") {
        throw new Error(`SMTP connection failed for ${host}:${port}. Use TLS on connect only for port 465; port 587 uses STARTTLS and must be non-secure on connect.`);
      }
      throw error;
    } finally {
      transport.close();
    }
    return;
  }

  console.info(`[mailer:console] to=${input.to} subject=${input.subject}\n${html}`);
}
