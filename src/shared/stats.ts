import { splitDurationAcrossDays, toLocalDateKey } from "./time";
import type { DailyChartPoint, StoredStats } from "./types";

export const STATS_STORAGE_KEY = "stats";
export const STATS_VERSION = 3 as const;

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function sanitizeDuration(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return 0;
  }

  return Math.round(value);
}

function sanitizeDailyDurations(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object") {
    return {};
  }

  const nextDurations: Record<string, number> = {};

  for (const [dateKey, rawDuration] of Object.entries(value as Record<string, unknown>)) {
    const durationMs = sanitizeDuration(rawDuration);

    if (!DATE_KEY_PATTERN.test(dateKey) || durationMs <= 0) {
      continue;
    }

    nextDurations[dateKey] = durationMs;
  }

  return nextDurations;
}

function getRecentDateKeys(days: number, nowMs = Date.now()): string[] {
  if (days <= 0) {
    return [];
  }

  const anchorDate = new Date(nowMs);
  anchorDate.setHours(12, 0, 0, 0);

  const dateKeys: string[] = [];

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(anchorDate);
    date.setDate(anchorDate.getDate() - offset);
    dateKeys.push(toLocalDateKey(date));
  }

  return dateKeys;
}

export function createEmptyStats(nowMs = Date.now()): StoredStats {
  return {
    version: STATS_VERSION,
    dailyDurationsByDate: {},
    updatedAtMs: nowMs
  };
}

export function normalizeStoredStats(value: unknown, nowMs = Date.now()): StoredStats {
  const emptyStats = createEmptyStats(nowMs);

  if (!value || typeof value !== "object") {
    return emptyStats;
  }

  const candidate = value as {
    version?: unknown;
    dailyDurationsByDate?: unknown;
    updatedAtMs?: unknown;
  };

  if (candidate.version !== STATS_VERSION) {
    return emptyStats;
  }

  const dailyDurationsByDate = sanitizeDailyDurations(candidate.dailyDurationsByDate);
  const updatedAtMs =
    typeof candidate.updatedAtMs === "number" && Number.isFinite(candidate.updatedAtMs)
      ? candidate.updatedAtMs
      : nowMs;

  return {
    version: STATS_VERSION,
    dailyDurationsByDate,
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

  const dailyDurationsByDate = { ...nextStats.dailyDurationsByDate };

  for (const segment of splitDurationAcrossDays(startMs, endMs)) {
    if (segment.durationMs <= 0) {
      continue;
    }

    dailyDurationsByDate[segment.date] = (dailyDurationsByDate[segment.date] ?? 0) + segment.durationMs;
  }

  return {
    ...nextStats,
    dailyDurationsByDate,
    updatedAtMs: endMs
  };
}

export function getTodayDurationMs(statsValue: unknown, nowMs = Date.now()): number {
  const stats = normalizeStoredStats(statsValue, nowMs);
  const todayDateKey = toLocalDateKey(nowMs);

  return stats.dailyDurationsByDate[todayDateKey] ?? 0;
}

export function hasTrackedHistory(statsValue: unknown, nowMs = Date.now()): boolean {
  const stats = normalizeStoredStats(statsValue, nowMs);
  return Object.keys(stats.dailyDurationsByDate).length > 0;
}

export function getRecentDailySeries(statsValue: unknown, days: number, nowMs = Date.now()): DailyChartPoint[] {
  const stats = normalizeStoredStats(statsValue, nowMs);
  const todayDateKey = toLocalDateKey(nowMs);

  return getRecentDateKeys(days, nowMs).map((dateKey) => ({
    date: dateKey,
    durationMs: stats.dailyDurationsByDate[dateKey] ?? 0,
    isToday: dateKey === todayDateKey,
    shortLabel: dateKey.slice(8)
  }));
}
