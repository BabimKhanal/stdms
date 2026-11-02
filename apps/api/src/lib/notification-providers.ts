import { env } from "../env";
import { sendMail, type MailConfig } from "./mailer";

export type DeliveryUser = { id: string; email?: string | null; phone?: string | null };
export type DeliveryMessage = { title: string; body: string; data?: Record<string, unknown> };
export type MailContent = { subject: string; html: string; text?: string };

export type DeliveryResult = {
  email?: { status: "sent" | "failed"; error?: string; subject: string; html: string };
};

async function webhook(url: string, payload: Record<string, unknown>) {
  const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  if (!response.ok) throw new Error(`Notification provider rejected the message (${response.status})`);
}

export async function deliverNotification(
  user: DeliveryUser,
  message: DeliveryMessage,
  mailConfig?: MailConfig,
  mailContent?: MailContent,
): Promise<DeliveryResult> {
  const result: DeliveryResult = {};
  const tasks: Promise<void>[] = [];
  const provider = mailConfig?.provider ?? env.MAILER_PROVIDER;
  const emailContent = mailContent ?? { subject: message.title, html: `<p>${message.body}</p>` };

  if (provider !== "console" && mailConfig?.enabled !== false && user.email) {
    try {
      await sendMail({ to: user.email, ...emailContent }, mailConfig);
      result.email = { status: "sent", ...emailContent };
    } catch (error) {
      result.email = { status: "failed", error: error instanceof Error ? error.message : "Email delivery failed", ...emailContent };
    }
  }

  if (env.SMS_PROVIDER === "webhook" && env.SMS_WEBHOOK_URL && user.phone) {
    tasks.push(webhook(env.SMS_WEBHOOK_URL, { channel: "sms", to: user.phone, body: `${message.title}: ${message.body}`, data: message.data ?? {} }));
  }
  if (env.PUSH_PROVIDER === "webhook" && env.PUSH_WEBHOOK_URL) {
    tasks.push(webhook(env.PUSH_WEBHOOK_URL, { channel: "push", userId: user.id, title: message.title, body: message.body, data: message.data ?? {} }));
  }
  await Promise.allSettled(tasks);
  return result;
}
