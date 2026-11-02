import test from "node:test";
import assert from "node:assert/strict";
import { getBackupKeysToDelete } from "../src/lib/backup-retention";

test("backup retention keeps recent dailies and one older backup per month", () => {
  const backups = [
    { key: "mar-25", lastModified: new Date("2026-03-25T02:00:00Z") },
    { key: "mar-24", lastModified: new Date("2026-03-24T02:00:00Z") },
    { key: "mar-23", lastModified: new Date("2026-03-23T02:00:00Z") },
    { key: "feb-02", lastModified: new Date("2026-02-02T02:00:00Z") },
    { key: "feb-01", lastModified: new Date("2026-02-01T02:00:00Z") },
    { key: "jan-01", lastModified: new Date("2026-01-01T02:00:00Z") },
    { key: "dec-01", lastModified: new Date("2025-12-01T02:00:00Z") },
  ];

  assert.deepEqual(getBackupKeysToDelete(backups, 2, 2), [
    "mar-23",
    "feb-01",
    "dec-01",
  ]);
});
