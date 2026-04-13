import { reconcileSession } from "./shared/session";
import { appendTrackedDuration, loadRuntimeState, saveRuntimeState } from "./shared/storage";
import type { CountableContext, IdleState } from "./shared/types";
import { extractActiveYouTubeContexts, pickCountableContext } from "./shared/youtube";

const HEARTBEAT_ALARM = "stats-heartbeat";
const HEARTBEAT_MINUTES = 0.5;
const IDLE_INTERVAL_SECONDS = 60;

let operationQueue = Promise.resolve();

function enqueue(reason: string, work: () => Promise<void>) {
  operationQueue = operationQueue
    .then(work, work)
    .catch((error) => {
      console.error(`Failed during ${reason}:`, error);
    });
}

async function ensureHeartbeatAlarm(): Promise<void> {
  const existingAlarm = await chrome.alarms.get(HEARTBEAT_ALARM);

  if (existingAlarm) {
    return;
  }

  chrome.alarms.create(HEARTBEAT_ALARM, {
    delayInMinutes: HEARTBEAT_MINUTES,
    periodInMinutes: HEARTBEAT_MINUTES
  });
}

async function getFocusedWindowId(): Promise<number | null> {
  try {
    const currentWindow = await chrome.windows.getLastFocused();
    return currentWindow.focused && typeof currentWindow.id === "number" ? currentWindow.id : null;
  } catch {
    return null;
  }
}

async function getIdleState(): Promise<IdleState> {
  const currentState = await chrome.idle.queryState(IDLE_INTERVAL_SECONDS);
  return currentState;
}

async function getCurrentContext(): Promise<{
  contexts: CountableContext[];
  focusedWindowId: number | null;
  idleState: IdleState;
}> {
  const [focusedWindowId, idleState, activeTabs] = await Promise.all([
    getFocusedWindowId(),
    getIdleState(),
    chrome.tabs.query({
      active: true,
      windowType: "normal"
    })
  ]);

  return {
    contexts: extractActiveYouTubeContexts(activeTabs),
    focusedWindowId,
    idleState
  };
}

async function reconcileCurrentBrowserState(reason: string): Promise<void> {
  const nowMs = Date.now();
  const [runtimeState, browserState] = await Promise.all([loadRuntimeState(nowMs), getCurrentContext()]);
  const context =
    browserState.idleState === "active"
      ? pickCountableContext(browserState.contexts, runtimeState.activeSession, browserState.focusedWindowId)
      : null;
  const result = reconcileSession({
    session: runtimeState.activeSession,
    context,
    nowMs
  });

  if (result.flushedDuration) {
    await appendTrackedDuration(result.flushedDuration.startMs, result.flushedDuration.endMs);
  }

  await saveRuntimeState({
    activeSession: result.nextSession,
    focusedWindowId: browserState.focusedWindowId,
    idleState: browserState.idleState,
    updatedAtMs: nowMs
  });

  console.debug(`Reconciled YouTube session after ${reason}.`);
}

function scheduleReconcile(reason: string) {
  enqueue(reason, async () => {
    chrome.idle.setDetectionInterval(IDLE_INTERVAL_SECONDS);
    await ensureHeartbeatAlarm();
    await reconcileCurrentBrowserState(reason);
  });
}

chrome.runtime.onInstalled.addListener(() => {
  scheduleReconcile("runtime.onInstalled");
});

chrome.runtime.onStartup.addListener(() => {
  scheduleReconcile("runtime.onStartup");
});

chrome.tabs.onActivated.addListener(() => {
  scheduleReconcile("tabs.onActivated");
});

chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
  if (typeof changeInfo.url === "string" || tab.active) {
    scheduleReconcile("tabs.onUpdated");
  }
});

chrome.tabs.onRemoved.addListener(() => {
  scheduleReconcile("tabs.onRemoved");
});

chrome.windows.onFocusChanged.addListener(() => {
  scheduleReconcile("windows.onFocusChanged");
});

chrome.idle.onStateChanged.addListener(() => {
  scheduleReconcile("idle.onStateChanged");
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === HEARTBEAT_ALARM) {
    scheduleReconcile("alarms.onAlarm");
  }
});

scheduleReconcile("bootstrap");
