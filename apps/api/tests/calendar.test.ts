import assert from "node:assert/strict";
import test from "node:test";
import {
  addBsMonths,
  adToBs,
  bsMonthAdRange,
  bsMonthGrid,
  bsToAd,
  calendarAudienceGroups,
  calendarEventRange,
  eventsOnDay,
  formatBsDate,
} from "@edu/shared";

test("every Bikram Sambat month contains a complete Sunday-first grid", () => {
  for (let year = 2080; year <= 2090; year += 1) {
    for (let month = 1; month <= 12; month += 1) {
      const weeks = bsMonthGrid(year, month);
      assert.equal(weeks.length % 1, 0);
      assert.ok(weeks.length >= 4 && weeks.length <= 6, `${year}-${month} has ${weeks.length} weeks`);
      for (const week of weeks) assert.equal(week.length, 7);
      const days = weeks.flat().filter((cell): cell is NonNullable<typeof cell> => Boolean(cell));
      const first = days[0];
      const last = days[days.length - 1];
      assert.equal(first?.bsDate.date, 1);
      assert.ok(first && /^(Sun|Mon|Tue|Wed|Thu|Fri|Sat)/.test(first.bsDate.day));
      assert.ok(last && last.bsDate.date >= 28);
    }
  }
});

test("AD and Bikram Sambat dates round-trip with correct month lengths", () => {
  const bs = adToBs("2026-11-06");
  assert.deepEqual(bs && { year: bs.year, month: bs.month, date: bs.date }, { year: 2083, month: 7, date: 20 });
  assert.equal(bsToAd(2083, 7, 20), "2026-11-06");
  assert.equal(formatBsDate("2026-11-06"), "2083 Kartik 20");
  assert.equal(formatBsDate("2026-11-06", "ne").startsWith("२०८३"), true);

  const range = bsMonthAdRange(2083, 7);
  assert.deepEqual(range, { start: "2026-10-18", end: "2026-11-16" });
  assert.equal(bsMonthGrid(2083, 7).flat().filter(Boolean).length, 30);
});

test("Bikram Sambat month arithmetic crosses year boundaries", () => {
  assert.deepEqual(addBsMonths(2083, 12, 1), { year: 2084, month: 1 });
  assert.deepEqual(addBsMonths(2083, 1, -1), { year: 2082, month: 12 });
  assert.deepEqual(addBsMonths(2083, 7, -18), { year: 2082, month: 1 });
});

test("multi-day events appear on every day and honour the exclusive calendar range", () => {
  const event = { id: "e1", startDate: "2026-11-05", endDate: "2026-11-07", startTime: null, endTime: null };
  assert.equal(eventsOnDay([event], "2026-11-04").length, 0);
  assert.equal(eventsOnDay([event], "2026-11-05").length, 1);
  assert.equal(eventsOnDay([event], "2026-11-07").length, 1);
  assert.equal(eventsOnDay([event], "2026-11-08").length, 0);
  assert.deepEqual(calendarEventRange(event), { allDay: true, start: "2026-11-05", end: "2026-11-08" });
});

test("calendar audiences follow the login identity", () => {
  assert.deepEqual(calendarAudienceGroups({ roles: ["student"], studentId: "s1" }).sort(), ["everyone", "students"]);
  assert.deepEqual(calendarAudienceGroups({ roles: ["parent"], guardianIds: [] }).sort(), ["everyone", "guardians", "parents"]);
  assert.deepEqual(calendarAudienceGroups({ roles: ["teacher"], employeeId: "e1" }).sort(), ["everyone", "staff", "teachers"]);
  assert.deepEqual(calendarAudienceGroups({ roles: ["accountant"], employeeId: "e2" }).sort(), ["everyone", "staff"]);
});
