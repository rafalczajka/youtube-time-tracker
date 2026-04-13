import assert from "node:assert/strict";
import test from "node:test";

import { formatDuration, splitDurationAcrossDays } from "../src/shared/time";

test("formats seconds, minutes, hours, and days compactly", () => {
  assert.equal(formatDuration(19_000), "19s");
  assert.equal(formatDuration(95_000), "1m");
  assert.equal(formatDuration((2 * 60 + 14) * 60 * 1_000), "2h 14m");
  assert.equal(formatDuration((27 * 60 * 60 + 15 * 60) * 1_000), "1d 3h");
});

test("splits tracked time when the interval crosses local midnight", () => {
  const startMs = new Date(2026, 3, 13, 23, 59, 30).getTime();
  const endMs = new Date(2026, 3, 14, 0, 0, 30).getTime();
  const segments = splitDurationAcrossDays(startMs, endMs);

  assert.equal(segments.length, 2);
  assert.deepEqual(
    segments.map((segment) => ({
      date: segment.date,
      durationMs: segment.durationMs
    })),
    [
      {
        date: "2026-04-13",
        durationMs: 30_000
      },
      {
        date: "2026-04-14",
        durationMs: 30_000
      }
    ]
  );
});
