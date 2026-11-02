import { env } from "../env";
import { sendMail, type MailConfig } from "./mailer";

export type DeliveryUser = {
  id: string;
  email?: string | null;
  phone?: string | null;
};
export type DeliveryMessage = {
  title: string;
  body: string;
  data?: Record<string, unknown>;
};
export type MailContent = { subject: string; html: string; text?: string };

export type DeliveryResult = {
  email?: {
    status: "sent" | "failed";
    error?: string;
    subject: string;
    html: string;
  };
};

export type ExpoPushMessage = {
  to: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
};

async function webhook(url: string, payload: Record<string, unknown>) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok)
    throw new Error(
      `Notification provider rejected the message (${response.status})`,
    );
}

export async function deliverExpoPushNotifications(
  messages: ExpoPushMessage[],
) {
  const invalidTokens: string[] = [];
  for (let offset = 0; offset < messages.length; offset += 100) {
    const batch = messages.slice(offset, offset + 100);
    try {
      const response = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...(env.EXPO_ACCESS_TOKEN
            ? { Authorization: `Bearer ${env.EXPO_ACCESS_TOKEN}` }
            : {}),
        },
        body: JSON.stringify(
          batch.map((message) => ({
            ...message,
            sound: "default",
            channelId: "updates",
          })),
        ),
        signal: AbortSignal.timeout(8_000),
      });
      if (!response.ok) {
        console.error(
          JSON.stringify({
            event: "expo_push_rejected",
            status: response.status,
          }),
        );
        continue;
      }
      const result = (await response.json()) as {
        data?: Array<{
          status?: string;
          message?: string;
          details?: { error?: string };
        }>;
      };
      result.data?.forEach((ticket, index) => {
        if (ticket.status !== "error") return;
        if (ticket.details?.error === "DeviceNotRegistered")
          invalidTokens.push(batch[index].to);
        else
          console.error(
            JSON.stringify({
              event: "expo_push_ticket_error",
              code: ticket.details?.error ?? "unknown",
            }),
          );
      });
    } catch (error) {
      console.error(
        JSON.stringify({
          event: "expo_push_transport_error",
          error: error instanceof Error ? error.message : "Push request failed",
        }),
      );
    }
  }
  return invalidTokens;
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
  const emailContent = mailContent ?? {
    subject: message.title,
    html: `<p>${message.body}</p>`,
  };

  if (provider !== "console" && mailConfig?.enabled !== false && user.email) {
    try {
      await sendMail({ to: user.email, ...emailContent }, mailConfig);
      result.email = { status: "sent", ...emailContent };
    } catch (error) {
      result.email = {
        status: "failed",
        error: error instanceof Error ? error.message : "Email delivery failed",
        ...emailContent,
      };
    }
  }

  if (env.SMS_PROVIDER === "webhook" && env.SMS_WEBHOOK_URL && user.phone) {
    tasks.push(
      webhook(env.SMS_WEBHOOK_URL, {
        channel: "sms",
        to: user.phone,
        body: `${message.title}: ${message.body}`,
        data: message.data ?? {},
      }),
    );
  }
  if (env.PUSH_PROVIDER === "webhook" && env.PUSH_WEBHOOK_URL) {
    tasks.push(
      webhook(env.PUSH_WEBHOOK_URL, {
        channel: "push",
        userId: user.id,
        title: message.title,
        body: message.body,
        data: message.data ?? {},
      }),
    );
  }
  await Promise.allSettled(tasks);
  return result;
}
