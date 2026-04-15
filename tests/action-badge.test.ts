import assert from "node:assert/strict";
import test from "node:test";

import { getActionBadgeState } from "../src/shared/action-badge";

test("returns the green ON badge when tracking is active", () => {
  assert.deepEqual(getActionBadgeState({ isCounting: true, isManuallyPaused: false }), {
    dotColor: "#1a7f37",
    title: "YouTube Time Tracker: counting now"
  });
});

test("returns the yellow paused badge when tracking is paused by runtime conditions", () => {
  assert.deepEqual(getActionBadgeState({ isCounting: false, isManuallyPaused: false }), {
    dotColor: "#d4a017",
    title: "YouTube Time Tracker: not counting"
  });
});

test("returns the yellow manual pause badge with a distinct title", () => {
  assert.deepEqual(getActionBadgeState({ isCounting: false, isManuallyPaused: true }), {
    dotColor: "#d4a017",
    title: "YouTube Time Tracker: paused manually"
  });
});
