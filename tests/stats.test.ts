import assert from "node:assert/strict";
import test from "node:test";

import { applyDurationToStats, normalizeStoredStats } from "../src/shared/stats";

test("rotates the today bucket and keeps only the current-day slice after midnight", () => {
  const startMs = new Date(2026, 3, 13, 23, 59, 30).getTime();
  const endMs = new Date(2026, 3, 14, 0, 0, 30).getTime();

  const nextStats = applyDurationToStats(
    {
      version: 1,
      totalsByDomain: {
        "google.com": 120_000
      },
      today: {
        date: "2026-04-13",
        byDomain: {
          "google.com": 120_000
        }
      },
      updatedAtMs: startMs
    },
    "google.com",
    startMs,
    endMs
  );

  assert.equal(nextStats.today.date, "2026-04-14");
  assert.equal(nextStats.today.byDomain["google.com"], 30_000);
  assert.equal(nextStats.totalsByDomain["google.com"], 180_000);
});

test("normalizes stale today data when storage is opened on a new day", () => {
  const normalized = normalizeStoredStats(
    {
      version: 1,
      totalsByDomain: {
        "example.com": 4_000
      },
      today: {
        date: "2026-04-12",
        byDomain: {
          "example.com": 4_000
        }
      },
      updatedAtMs: 1
    },
    new Date(2026, 3, 13, 9, 0, 0).getTime()
  );

  assert.deepEqual(normalized.today, {
    date: "2026-04-13",
    byDomain: {}
  });
});
