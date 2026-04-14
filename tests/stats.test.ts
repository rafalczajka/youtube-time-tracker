import assert from "node:assert/strict";
import test from "node:test";

import {
  applyDurationToStats,
  getRecentDailySeries,
  getTodayDurationMs,
  normalizeStoredStats
} from "../src/shared/stats";

test("adds tracked time to the correct daily YouTube bucket", () => {
  const startMs = new Date(2026, 3, 13, 10, 0, 0).getTime();
  const endMs = new Date(2026, 3, 13, 10, 2, 0).getTime();
  const nextStats = applyDurationToStats(undefined, startMs, endMs);

  assert.equal(nextStats.version, 3);
  assert.deepEqual(nextStats.dailyDurationsByDate, {
    "2026-04-13": 120_000
  });
});

test("splits tracked time between daily buckets when the interval crosses midnight", () => {
  const startMs = new Date(2026, 3, 13, 23, 59, 30).getTime();
  const endMs = new Date(2026, 3, 14, 0, 0, 30).getTime();

  const nextStats = applyDurationToStats(
    {
      version: 3,
      dailyDurationsByDate: {
        "2026-04-13": 120_000
      },
      updatedAtMs: startMs
    },
    startMs,
    endMs
  );

  assert.deepEqual(nextStats.dailyDurationsByDate, {
    "2026-04-13": 150_000,
    "2026-04-14": 30_000
  });
});

test("keeps valid daily history and drops invalid daily entries", () => {
  const normalized = normalizeStoredStats(
    {
      version: 3,
      dailyDurationsByDate: {
        "2026-04-12": 4_000,
        "2026-04-13": -50,
        invalid: 20_000,
        "2026-04-15": "oops"
      },
      updatedAtMs: 1
    },
    new Date(2026, 3, 13, 9, 0, 0).getTime()
  );

  assert.deepEqual(normalized.dailyDurationsByDate, {
    "2026-04-12": 4_000
  });
});

test("treats the old v2 schema as incompatible and starts from zero", () => {
  const normalized = normalizeStoredStats(
    {
      version: 2,
      totalMs: 99_000,
      today: {
        date: "2026-04-13",
        durationMs: 99_000
      },
      updatedAtMs: 1
    },
    new Date(2026, 3, 13, 9, 0, 0).getTime()
  );

  assert.deepEqual(normalized, {
    version: 3,
    dailyDurationsByDate: {},
    updatedAtMs: new Date(2026, 3, 13, 9, 0, 0).getTime()
  });
});

test("returns 0 for today when the current day has no entry", () => {
  const todayDurationMs = getTodayDurationMs(
    {
      version: 3,
      dailyDurationsByDate: {
        "2026-04-12": 40_000
      },
      updatedAtMs: 1
    },
    new Date(2026, 3, 13, 9, 0, 0).getTime()
  );

  assert.equal(todayDurationMs, 0);
});

test("returns a 14-day chart series with zero-filled gaps in chronological order", () => {
  const series = getRecentDailySeries(
    {
      version: 3,
      dailyDurationsByDate: {
        "2026-04-03": 60_000,
        "2026-04-08": 120_000,
        "2026-04-14": 180_000
      },
      updatedAtMs: 1
    },
    14,
    new Date(2026, 3, 14, 12, 0, 0).getTime()
  );

  assert.equal(series.length, 14);
  assert.deepEqual(series[0], {
    date: "2026-04-01",
    durationMs: 0,
    isToday: false,
    shortLabel: "01"
  });
  assert.deepEqual(series[2], {
    date: "2026-04-03",
    durationMs: 60_000,
    isToday: false,
    shortLabel: "03"
  });
  assert.deepEqual(series[7], {
    date: "2026-04-08",
    durationMs: 120_000,
    isToday: false,
    shortLabel: "08"
  });
  assert.deepEqual(series[13], {
    date: "2026-04-14",
    durationMs: 180_000,
    isToday: true,
    shortLabel: "14"
  });
});
