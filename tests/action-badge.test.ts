import assert from "node:assert/strict";
import test from "node:test";

import { getActionBadgeState } from "../src/shared/action-badge";

test("returns the green ON badge when tracking is active", () => {
  assert.deepEqual(getActionBadgeState(true), {
    dotColor: "#1a7f37",
    title: "YouTube Time Tracker: counting now"
  });
});

test("returns the yellow PAU badge when tracking is paused", () => {
  assert.deepEqual(getActionBadgeState(false), {
    dotColor: "#d4a017",
    title: "YouTube Time Tracker: not counting"
  });
});
