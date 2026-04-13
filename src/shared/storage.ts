import { applyDurationToStats, normalizeStoredStats, STATS_STORAGE_KEY } from "./stats";
import type { ActiveSession, IdleState, RuntimeState, StoredStats } from "./types";

const RUNTIME_STATE_STORAGE_KEY = "runtimeState";

function sanitizeActiveSession(value: unknown): ActiveSession | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Record<string, unknown>;

  if (
    typeof candidate.tabId !== "number" ||
    !Number.isFinite(candidate.tabId) ||
    typeof candidate.windowId !== "number" ||
    !Number.isFinite(candidate.windowId) ||
    typeof candidate.startedAtMs !== "number" ||
    !Number.isFinite(candidate.startedAtMs) ||
    typeof candidate.lastFlushedAtMs !== "number" ||
    !Number.isFinite(candidate.lastFlushedAtMs)
  ) {
    return null;
  }

  return {
    tabId: candidate.tabId,
    windowId: candidate.windowId,
    startedAtMs: candidate.startedAtMs,
    lastFlushedAtMs: candidate.lastFlushedAtMs
  };
}

function sanitizeIdleState(value: unknown): IdleState {
  return value === "idle" || value === "locked" ? value : "active";
}

function createDefaultRuntimeState(nowMs = Date.now()): RuntimeState {
  return {
    activeSession: null,
    focusedWindowId: null,
    idleState: "active",
    updatedAtMs: nowMs
  };
}

function normalizeRuntimeState(value: unknown, nowMs = Date.now()): RuntimeState {
  const emptyRuntimeState = createDefaultRuntimeState(nowMs);

  if (!value || typeof value !== "object") {
    return emptyRuntimeState;
  }

  const candidate = value as {
    activeSession?: unknown;
    focusedWindowId?: unknown;
    idleState?: unknown;
    updatedAtMs?: unknown;
  };

  return {
    activeSession: sanitizeActiveSession(candidate.activeSession),
    focusedWindowId:
      typeof candidate.focusedWindowId === "number" && Number.isFinite(candidate.focusedWindowId)
        ? candidate.focusedWindowId
        : null,
    idleState: sanitizeIdleState(candidate.idleState),
    updatedAtMs:
      typeof candidate.updatedAtMs === "number" && Number.isFinite(candidate.updatedAtMs)
        ? candidate.updatedAtMs
        : nowMs
  };
}

export async function loadStoredStats(nowMs = Date.now()): Promise<StoredStats> {
  const result = await chrome.storage.local.get(STATS_STORAGE_KEY);
  return normalizeStoredStats(result[STATS_STORAGE_KEY], nowMs);
}

export async function appendTrackedDuration(startMs: number, endMs: number): Promise<StoredStats> {
  const result = await chrome.storage.local.get(STATS_STORAGE_KEY);
  const nextStats = applyDurationToStats(result[STATS_STORAGE_KEY], startMs, endMs);

  await chrome.storage.local.set({
    [STATS_STORAGE_KEY]: nextStats
  });

  return nextStats;
}

export async function loadRuntimeState(nowMs = Date.now()): Promise<RuntimeState> {
  const sessionStorage = chrome.storage.session;

  if (!sessionStorage) {
    return createDefaultRuntimeState(nowMs);
  }

  const result = await sessionStorage.get(RUNTIME_STATE_STORAGE_KEY);
  return normalizeRuntimeState(result[RUNTIME_STATE_STORAGE_KEY], nowMs);
}

export async function saveRuntimeState(state: RuntimeState): Promise<void> {
  const sessionStorage = chrome.storage.session;

  if (!sessionStorage) {
    return;
  }

  await sessionStorage.set({
    [RUNTIME_STATE_STORAGE_KEY]: state
  });
}
