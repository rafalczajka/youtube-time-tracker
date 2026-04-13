import { splitDurationAcrossDays, toLocalDateKey } from "./time";
import type { DomainStatsRow, StoredStats } from "./types";

export const STATS_STORAGE_KEY = "stats";
export const STATS_VERSION = 1 as const;

function sanitizeDurationRecord(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object") {
    return {};
  }

  const record = value as Record<string, unknown>;
  const nextRecord: Record<string, number> = {};

  for (const [domain, rawValue] of Object.entries(record)) {
    if (!domain || typeof rawValue !== "number" || !Number.isFinite(rawValue) || rawValue <= 0) {
      continue;
    }

    nextRecord[domain] = Math.round(rawValue);
  }

  return nextRecord;
}

export function createEmptyStats(nowMs = Date.now()): StoredStats {
  return {
    version: STATS_VERSION,
    totalsByDomain: {},
    today: {
      date: toLocalDateKey(nowMs),
      byDomain: {}
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
    totalsByDomain?: unknown;
    today?: {
      date?: unknown;
      byDomain?: unknown;
    };
    updatedAtMs?: unknown;
  };

  const totalsByDomain = sanitizeDurationRecord(candidate.totalsByDomain);
  const storedDate = typeof candidate.today?.date === "string" ? candidate.today.date : currentDate;
  const todayByDomain = storedDate === currentDate ? sanitizeDurationRecord(candidate.today?.byDomain) : {};
  const updatedAtMs =
    typeof candidate.updatedAtMs === "number" && Number.isFinite(candidate.updatedAtMs)
      ? candidate.updatedAtMs
      : nowMs;

  return {
    version: STATS_VERSION,
    totalsByDomain,
    today: {
      date: currentDate,
      byDomain: todayByDomain
    },
    updatedAtMs
  };
}

export function applyDurationToStats(
  statsValue: unknown,
  domainKey: string,
  startMs: number,
  endMs: number
): StoredStats {
  const nextStats = normalizeStoredStats(statsValue, endMs);

  if (!domainKey || endMs <= startMs) {
    return {
      ...nextStats,
      updatedAtMs: endMs
    };
  }

  const totalsByDomain = { ...nextStats.totalsByDomain };
  const todayByDomain = { ...nextStats.today.byDomain };

  for (const segment of splitDurationAcrossDays(startMs, endMs)) {
    if (segment.durationMs <= 0) {
      continue;
    }

    totalsByDomain[domainKey] = (totalsByDomain[domainKey] ?? 0) + segment.durationMs;

    if (segment.date === nextStats.today.date) {
      todayByDomain[domainKey] = (todayByDomain[domainKey] ?? 0) + segment.durationMs;
    }
  }

  return {
    ...nextStats,
    totalsByDomain,
    today: {
      date: nextStats.today.date,
      byDomain: todayByDomain
    },
    updatedAtMs: endMs
  };
}

export function buildDomainRows(statsValue: unknown, nowMs = Date.now()): DomainStatsRow[] {
  const stats = normalizeStoredStats(statsValue, nowMs);
  const domainKeys = new Set([
    ...Object.keys(stats.totalsByDomain),
    ...Object.keys(stats.today.byDomain)
  ]);

  return [...domainKeys]
    .map((domain) => ({
      domain,
      todayMs: stats.today.byDomain[domain] ?? 0,
      totalMs: stats.totalsByDomain[domain] ?? 0
    }))
    .sort(
      (left, right) =>
        right.todayMs - left.todayMs ||
        right.totalMs - left.totalMs ||
        left.domain.localeCompare(right.domain)
    );
}

export function getTodayTotalMs(statsValue: unknown, nowMs = Date.now()): number {
  const stats = normalizeStoredStats(statsValue, nowMs);

  return Object.values(stats.today.byDomain).reduce((sum, current) => sum + current, 0);
}
