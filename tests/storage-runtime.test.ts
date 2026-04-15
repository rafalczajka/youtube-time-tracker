import assert from "node:assert/strict";
import test from "node:test";

import { loadRuntimeState } from "../src/shared/storage";

test("loadRuntimeState returns defaults including manual pause disabled when session storage is unavailable", async () => {
  const originalChrome = globalThis.chrome;
  globalThis.chrome = {
    storage: {}
  } as typeof chrome;

  try {
    const runtimeState = await loadRuntimeState(1_234);

    assert.deepEqual(runtimeState, {
      activeSession: null,
      focusedWindowId: null,
      isManuallyPaused: false,
      idleState: "active",
      updatedAtMs: 1_234
    });
  } finally {
    globalThis.chrome = originalChrome;
  }
});
