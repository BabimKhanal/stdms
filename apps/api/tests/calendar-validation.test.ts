import assert from "node:assert/strict";
import test from "node:test";
import { eventInputSchema } from "@edu/shared";

const baseEvent = {
  title: "Winter holiday",
  startDate: "2026-12-24",
  audiences: ["everyone"],
};

test("calendar events support typed holidays", () => {
  const result = eventInputSchema.safeParse({ ...baseEvent, eventType: "holiday" });
  assert.equal(result.success, true);
  if (result.success) assert.equal(result.data.eventType, "holiday");
});

test("calendar events reject an end date before the start date", () => {
  const result = eventInputSchema.safeParse({
    ...baseEvent,
    endDate: "2026-12-23",
  });
  assert.equal(result.success, false);
});

test("calendar events reject an end time before the start time on one day", () => {
  const result = eventInputSchema.safeParse({
    ...baseEvent,
    startTime: "15:00",
    endTime: "14:00",
  });
  assert.equal(result.success, false);
});
