export type IdleState = "active" | "idle" | "locked";

export interface TodayStats {
  date: string;
  byDomain: Record<string, number>;
}

export interface StoredStats {
  version: 1;
  totalsByDomain: Record<string, number>;
  today: TodayStats;
  updatedAtMs: number;
}

export interface CountableContext {
  tabId: number;
  windowId: number;
  domainKey: string;
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
  domainKey: string;
  startMs: number;
  endMs: number;
}

export interface SessionReconcileResult {
  nextSession: ActiveSession | null;
  flushedDuration: SessionFlush | null;
}

export interface DomainStatsRow {
  domain: string;
  todayMs: number;
  totalMs: number;
}
