import assert from "node:assert/strict";
import test from "node:test";

import { applyDurationToStats, normalizeStoredStats } from "../src/shared/stats";

test("adds tracked time to today's and total YouTube counters", () => {
  const startMs = new Date(2026, 3, 13, 10, 0, 0).getTime();
  const endMs = new Date(2026, 3, 13, 10, 2, 0).getTime();
  const nextStats = applyDurationToStats(undefined, startMs, endMs);

  assert.equal(nextStats.version, 2);
  assert.equal(nextStats.totalMs, 120_000);
  assert.equal(nextStats.today.date, "2026-04-13");
  assert.equal(nextStats.today.durationMs, 120_000);
});

test("rotates the today bucket and keeps only the current-day slice after midnight", () => {
  const startMs = new Date(2026, 3, 13, 23, 59, 30).getTime();
  const endMs = new Date(2026, 3, 14, 0, 0, 30).getTime();

  const nextStats = applyDurationToStats(
    {
      version: 2,
      totalMs: 120_000,
      today: {
        date: "2026-04-13",
        durationMs: 120_000
      },
      updatedAtMs: startMs
    },
    startMs,
    endMs
  );

  assert.equal(nextStats.today.date, "2026-04-14");
  assert.equal(nextStats.today.durationMs, 30_000);
  assert.equal(nextStats.totalMs, 180_000);
});

test("normalizes stale today data when storage is opened on a new day", () => {
  const normalized = normalizeStoredStats(
    {
      version: 2,
      totalMs: 4_000,
      today: {
        date: "2026-04-12",
        durationMs: 4_000
      },
      updatedAtMs: 1
    },
    new Date(2026, 3, 13, 9, 0, 0).getTime()
  );

  assert.deepEqual(normalized.today, {
    date: "2026-04-13",
    durationMs: 0
  });
  assert.equal(normalized.totalMs, 4_000);
});

test("treats the old multi-domain schema as incompatible and starts from zero", () => {
  const normalized = normalizeStoredStats(
    {
      version: 1,
      totalsByDomain: {
        "youtube.com": 99_000
      },
      today: {
        date: "2026-04-13",
        byDomain: {
          "youtube.com": 99_000
        }
      },
      updatedAtMs: 1
    },
    new Date(2026, 3, 13, 9, 0, 0).getTime()
  );

  assert.deepEqual(normalized, {
    version: 2,
    totalMs: 0,
    today: {
      date: "2026-04-13",
      durationMs: 0
    },
    updatedAtMs: new Date(2026, 3, 13, 9, 0, 0).getTime()
  });
});
