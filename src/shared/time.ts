import type { DurationSegment } from "./types";

const SECOND_MS = 1_000;
const MINUTE_MS = 60_000;
const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

export function toLocalDateKey(value: number | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function getStartOfNextDayMs(value: number | Date): number {
  const date = value instanceof Date ? new Date(value) : new Date(value);
  date.setHours(24, 0, 0, 0);
  return date.getTime();
}

export function splitDurationAcrossDays(startMs: number, endMs: number): DurationSegment[] {
  if (endMs <= startMs) {
    return [];
  }

  const segments: DurationSegment[] = [];
  let cursorMs = startMs;

  while (cursorMs < endMs) {
    const nextBoundaryMs = getStartOfNextDayMs(cursorMs);
    const segmentEndMs = Math.min(endMs, nextBoundaryMs);

    segments.push({
      date: toLocalDateKey(cursorMs),
      startMs: cursorMs,
      endMs: segmentEndMs,
      durationMs: segmentEndMs - cursorMs
    });

    cursorMs = segmentEndMs;
  }

  return segments;
}

export function formatDuration(durationMs: number): string {
  if (durationMs <= 0) {
    return "0s";
  }

  if (durationMs < MINUTE_MS) {
    return `${Math.max(1, Math.round(durationMs / SECOND_MS))}s`;
  }

  if (durationMs < HOUR_MS) {
    return `${Math.floor(durationMs / MINUTE_MS)}m`;
  }

  if (durationMs < DAY_MS) {
    const hours = Math.floor(durationMs / HOUR_MS);
    const minutes = Math.floor((durationMs % HOUR_MS) / MINUTE_MS);
    return `${hours}h ${minutes}m`;
  }

  const days = Math.floor(durationMs / DAY_MS);
  const hours = Math.floor((durationMs % DAY_MS) / HOUR_MS);
  return `${days}d ${hours}h`;
}
