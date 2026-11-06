import test from "node:test";
import assert from "node:assert/strict";
import { canTransitionStudent, lifecycleStatusForPromotion, requiresDestination } from "../src/modules/students/lifecycle-policy";

test("student lifecycle permits explicit reversible and terminal transitions", () => {
  assert.equal(canTransitionStudent("active", "suspended"), true);
  assert.equal(canTransitionStudent("suspended", "active"), true);
  assert.equal(canTransitionStudent("withdrawn", "active"), true);
  assert.equal(canTransitionStudent("graduated", "active"), false);
  assert.equal(canTransitionStudent("alumni", "active"), false);
});

test("only promotion and repetition create a destination placement", () => {
  assert.equal(requiresDestination("promoted"), true);
  assert.equal(requiresDestination("repeated"), true);
  assert.equal(requiresDestination("graduated"), false);
  assert.equal(lifecycleStatusForPromotion("transferred"), "transferred");
  assert.equal(lifecycleStatusForPromotion("promoted"), null);
});