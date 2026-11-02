import test from "node:test";
import assert from "node:assert/strict";
import { hasLoginIdentifier, remainingActiveOwnerCount } from "../src/modules/users/policy";

test("user accounts retain at least one login identifier", () => {
  assert.equal(hasLoginIdentifier("person@example.com", null), true);
  assert.equal(hasLoginIdentifier(null, "person.username"), true);
  assert.equal(hasLoginIdentifier("  ", ""), false);
  assert.equal(hasLoginIdentifier(null, null), false);
});

test("owner safeguards count active owners left after a mutation", () => {
  const owners = [
    { userId: "owner-1", status: "active" },
    { userId: "owner-2", status: "active" },
    { userId: "owner-3", status: "inactive" },
  ];

  assert.equal(remainingActiveOwnerCount(owners, ["owner-1"]), 1);
  assert.equal(remainingActiveOwnerCount(owners, ["owner-1", "owner-2"]), 0);
  assert.equal(remainingActiveOwnerCount(owners, ["owner-3"]), 2);
});