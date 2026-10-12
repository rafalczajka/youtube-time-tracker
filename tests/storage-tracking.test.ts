import assert from "node:assert/strict";
import test from "node:test";

import { appendTrackedDuration, loadStoredStats } from "../src/shared/storage";
import type { ActiveSession, StoredStats } from "../src/shared/types";

async function withLocalStorage(work: () => Promise<void>): Promise<void> {
  const originalChrome = globalThis.chrome;
  const data: Record<string, unknown> = {};
  globalThis.chrome = {
    storage: {
      local: {
        async get(key: string) { return structuredClone({ [key]: data[key] }); },
        async set(update: Record<string, unknown>) { Object.assign(data, structuredClone(update)); }
      }
    }
  } as unknown as typeof chrome;

  try {
    await work();
  } finally {
    globalThis.chrome = originalChrome;
  }
}

function total(stats: StoredStats): number {
  return Object.values(stats.dailyDurationsByDate).reduce((sum, duration) => sum + duration, 0);
}

test("retrying the same session flush is idempotent", async () => {
  await withLocalStorage(async () => {
    const session: ActiveSession = { tabId: 7, windowId: 1, startedAtMs: 1_000, lastFlushedAtMs: 1_000 };
    await appendTrackedDuration(session, 31_000);
    const retried = await appendTrackedDuration(session, 31_000);
    assert.equal(total(retried), 30_000);
    assert.equal((await loadStoredStats()).trackingCheckpoint?.endMs, 31_000);

    const extended = await appendTrackedDuration(session, 61_000);
    assert.equal(total(extended), 60_000);
  });
});

test("overlapping retries crossing midnight preserve each day's duration", async () => {
  await withLocalStorage(async () => {
    const startMs = new Date(2026, 9, 12, 23, 59, 30).getTime();
    const session: ActiveSession = { tabId: 7, windowId: 1, startedAtMs: startMs, lastFlushedAtMs: startMs };
    await appendTrackedDuration(session, startMs + 40_000);
    const retried = await appendTrackedDuration(session, startMs + 60_000);
    assert.deepEqual(retried.dailyDurationsByDate, { "2026-10-12": 30_000, "2026-10-13": 30_000 });
  });
});

test("a checkpoint from another session does not truncate newly tracked time", async () => {
  await withLocalStorage(async () => {
    await appendTrackedDuration({ tabId: 7, windowId: 1, startedAtMs: 1_000, lastFlushedAtMs: 1_000 }, 31_000);
    const next = await appendTrackedDuration({ tabId: 8, windowId: 1, startedAtMs: 2_000, lastFlushedAtMs: 2_000 }, 32_000);
    assert.equal(total(next), 60_000);
    assert.equal(next.trackingCheckpoint?.tabId, 8);
  });
});
