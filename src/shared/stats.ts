import { splitDurationAcrossDays, toLocalDateKey } from "./time";
import type { StoredStats } from "./types";

export const STATS_STORAGE_KEY = "stats";
export const STATS_VERSION = 2 as const;

function sanitizeDuration(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return 0;
  }

  return Math.round(value);
}

export function createEmptyStats(nowMs = Date.now()): StoredStats {
  return {
    version: STATS_VERSION,
    totalMs: 0,
    today: {
      date: toLocalDateKey(nowMs),
      durationMs: 0
    },
    updatedAtMs: nowMs
  };
}

export function normalizeStoredStats(value: unknown, nowMs = Date.now()): StoredStats {
  const emptyStats = createEmptyStats(nowMs);

  if (!value || typeof value !== "object") {
    return emptyStats;
  }

  const currentDate = toLocalDateKey(nowMs);
  const candidate = value as {
    version?: unknown;
    totalMs?: unknown;
    today?: {
      date?: unknown;
      durationMs?: unknown;
    };
    updatedAtMs?: unknown;
  };

  if (candidate.version !== STATS_VERSION) {
    return emptyStats;
  }

  const totalMs = sanitizeDuration(candidate.totalMs);
  const storedDate = typeof candidate.today?.date === "string" ? candidate.today.date : currentDate;
  const todayDurationMs = storedDate === currentDate ? sanitizeDuration(candidate.today?.durationMs) : 0;
  const updatedAtMs =
    typeof candidate.updatedAtMs === "number" && Number.isFinite(candidate.updatedAtMs)
      ? candidate.updatedAtMs
      : nowMs;

  return {
    version: STATS_VERSION,
    totalMs,
    today: {
      date: currentDate,
      durationMs: todayDurationMs
    },
    updatedAtMs
  };
}

export function applyDurationToStats(statsValue: unknown, startMs: number, endMs: number): StoredStats {
  const nextStats = normalizeStoredStats(statsValue, endMs);

  if (endMs <= startMs) {
    return {
      ...nextStats,
      updatedAtMs: endMs
    };
  }

  let totalMs = nextStats.totalMs;
  let todayDurationMs = nextStats.today.durationMs;

  for (const segment of splitDurationAcrossDays(startMs, endMs)) {
    if (segment.durationMs <= 0) {
      continue;
    }

    totalMs += segment.durationMs;

    if (segment.date === nextStats.today.date) {
      todayDurationMs += segment.durationMs;
    }
  }

  return {
    ...nextStats,
    totalMs,
    today: {
      date: nextStats.today.date,
      durationMs: todayDurationMs
    },
    updatedAtMs: endMs
  };
}
