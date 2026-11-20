import assert from "node:assert/strict";
import test from "node:test";

import { getActionBadgeState } from "../src/shared/action-badge";
import type { IdleState } from "../src/shared/types";

const inactiveState = { activeSession: null, idleState: "active", isManuallyPaused: false } as const;

test("returns the green ON badge when tracking is active", () => {
  const activeSession = { tabId: 7, windowId: 1, startedAtMs: 1_000, lastFlushedAtMs: 1_000 };

  assert.deepEqual(getActionBadgeState({ ...inactiveState, activeSession }), {
    isCounting: true,
    label: "Counting",
    dotColor: "#1a7f37",
    title: "YouTube Time Tracker: counting now"
  });
});

const inactiveReasons: [IdleState, boolean, string, string?][] = [
  ["active", false, "No YouTube tab", "No active YouTube tab"],
  ["idle", false, "Idle"],
  ["locked", false, "Screen locked"],
  ["idle", true, "Paused manually"]
];

for (const [idleState, isManuallyPaused, label, description = label] of inactiveReasons) {
  test(`shows a yellow indicator for "${label}"`, () => {
    assert.deepEqual(getActionBadgeState({ ...inactiveState, idleState, isManuallyPaused }), {
      isCounting: false,
      label,
      dotColor: "#d4a017",
      title: `YouTube Time Tracker: ${description}`
    });
  });
}
