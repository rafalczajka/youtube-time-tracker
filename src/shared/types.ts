export type IdleState = "active" | "idle" | "locked";

export interface TodayStats {
  date: string;
  durationMs: number;
}

export interface StoredStats {
  version: 2;
  totalMs: number;
  today: TodayStats;
  updatedAtMs: number;
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
