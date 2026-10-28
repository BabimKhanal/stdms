import { env } from "../env";
import { sendMail } from "./mailer";

export type DeliveryUser = { id: string; email?: string | null; phone?: string | null };
export type DeliveryMessage = { title: string; body: string; data?: Record<string, unknown> };

async function webhook(url: string, payload: Record<string, unknown>) {
  const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  if (!response.ok) throw new Error(`Notification provider rejected the message (${response.status})`);
}

export async function deliverNotification(user: DeliveryUser, message: DeliveryMessage) {
  const tasks: Promise<void>[] = [];
  if (env.MAILER_PROVIDER !== "console" && user.email) tasks.push(sendMail({ to: user.email, subject: message.title, html: `<p>${message.body}</p>` }));
  if (env.SMS_PROVIDER === "webhook" && env.SMS_WEBHOOK_URL && user.phone) tasks.push(webhook(env.SMS_WEBHOOK_URL, { channel: "sms", to: user.phone, body: `${message.title}: ${message.body}`, data: message.data ?? {} }));
  if (env.PUSH_PROVIDER === "webhook" && env.PUSH_WEBHOOK_URL) tasks.push(webhook(env.PUSH_WEBHOOK_URL, { channel: "push", userId: user.id, title: message.title, body: message.body, data: message.data ?? {} }));
  await Promise.allSettled(tasks);
}
