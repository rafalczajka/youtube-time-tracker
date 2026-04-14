export type IdleState = "active" | "idle" | "locked";

export interface StoredStats {
  version: 3;
  dailyDurationsByDate: Record<string, number>;
  updatedAtMs: number;
}

export interface DailyChartPoint {
  date: string;
  durationMs: number;
  isToday: boolean;
  shortLabel: string;
}

export interface CountableContext {
  tabId: number;
  windowId: number;
}

export interface ActiveSession extends CountableContext {
  startedAtMs: number;
  lastFlushedAtMs: number;
}

export interface RuntimeState {
  activeSession: ActiveSession | null;
  focusedWindowId: number | null;
  idleState: IdleState;
  updatedAtMs: number;
}

export interface DurationSegment {
  date: string;
  startMs: number;
  endMs: number;
  durationMs: number;
}

export interface SessionFlush {
  startMs: number;
  endMs: number;
}

export interface SessionReconcileResult {
  nextSession: ActiveSession | null;
  flushedDuration: SessionFlush | null;
}
