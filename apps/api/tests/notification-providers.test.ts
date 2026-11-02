import test from "node:test";
import assert from "node:assert/strict";
import { deliverExpoPushNotifications } from "../src/lib/notification-providers";

test("Expo delivery batches requests and returns unregistered tokens", async () => {
  const originalFetch = globalThis.fetch;
  const sentBatchSizes: number[] = [];
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    const messages = JSON.parse(String(init?.body)) as Array<{ to: string }>;
    sentBatchSizes.push(messages.length);
    return new Response(
      JSON.stringify({
        data: messages.map((message, index) => ({
          status: index === 0 && sentBatchSizes.length === 1 ? "error" : "ok",
          details:
            index === 0 && sentBatchSizes.length === 1
              ? { error: "DeviceNotRegistered" }
              : undefined,
          message: message.to,
        })),
      }),
      { status: 200 },
    );
  }) as typeof fetch;

  try {
    const invalidTokens = await deliverExpoPushNotifications(
      Array.from({ length: 101 }, (_, index) => ({
        to: `ExponentPushToken[device-${index}]`,
        title: "School update",
        body: "A new update is available.",
        data: { screen: "updates" },
      })),
    );

    assert.deepEqual(sentBatchSizes, [100, 1]);
    assert.deepEqual(invalidTokens, ["ExponentPushToken[device-0]"]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
