import { getActionBadgeState } from "./shared/action-badge";
import { TOGGLE_TRACKING_COMMAND } from "./shared/commands";
import { reconcileSession } from "./shared/session";
import { appendTrackedDuration, loadRuntimeState, saveRuntimeState } from "./shared/storage";
import type { CountableContext, IdleState, RuntimeMessage, RuntimeState } from "./shared/types";
import { extractActiveYouTubeContexts, pickCountableContext } from "./shared/youtube";

const HEARTBEAT_ALARM = "stats-heartbeat";
const HEARTBEAT_MINUTES = 0.5;
const IDLE_INTERVAL_SECONDS = 60;
const ACTION_ICON_SIZES = [16, 24, 32] as const;

let operationQueue = Promise.resolve();
const actionIconCache = new Map<string, Promise<Record<number, ImageData>>>();

function enqueue(reason: string, work: () => Promise<void>) {
  operationQueue = operationQueue
    .then(work, work)
    .catch((error) => {
      console.error(`Failed during ${reason}:`, error);
    });
}

async function syncActionBadge(isCounting: boolean): Promise<void> {
  const runtimeState = await loadRuntimeState();
  const badgeState = getActionBadgeState({
    isCounting,
    isManuallyPaused: runtimeState.isManuallyPaused
  });
  const imageData = await getActionIconSet(badgeState.dotColor);

  await Promise.all([
    chrome.action.setBadgeText({
      text: ""
    }),
    chrome.action.setIcon({ imageData }),
    chrome.action.setTitle({
      title: badgeState.title
    })
  ]);
}

async function syncActionBadgeFromState(runtimeState: RuntimeState): Promise<void> {
  const badgeState = getActionBadgeState({
    isCounting: runtimeState.activeSession !== null,
    isManuallyPaused: runtimeState.isManuallyPaused
  });
  const imageData = await getActionIconSet(badgeState.dotColor);

  await Promise.all([
    chrome.action.setBadgeText({
      text: ""
    }),
    chrome.action.setIcon({ imageData }),
    chrome.action.setTitle({
      title: badgeState.title
    })
  ]);
}

async function getActionIconSet(dotColor: string): Promise<Record<number, ImageData>> {
  const existingIconSet = actionIconCache.get(dotColor);

  if (existingIconSet) {
    return existingIconSet;
  }

  const nextIconSet = buildActionIconSet(dotColor);
  actionIconCache.set(dotColor, nextIconSet);
  return nextIconSet;
}

async function buildActionIconSet(dotColor: string): Promise<Record<number, ImageData>> {
  const entries = await Promise.all(
    ACTION_ICON_SIZES.map(async (size) => {
      const imageBitmap = await loadActionIconBitmap(size);
      const canvas = new OffscreenCanvas(size, size);
      const context = canvas.getContext("2d");

      if (!context) {
        throw new Error("Failed to create canvas context for action icon.");
      }

      const radius = Math.max(3, Math.round(size * 0.22));
      const centerX = size - radius - 1;
      const centerY = size - radius - 1;

      context.clearRect(0, 0, size, size);
      context.drawImage(imageBitmap, 0, 0, size, size);

      context.fillStyle = "rgba(255, 255, 255, 0.96)";
      context.beginPath();
      context.arc(centerX, centerY, radius + 1.5, 0, Math.PI * 2);
      context.fill();

      context.fillStyle = dotColor;
      context.beginPath();
      context.arc(centerX, centerY, radius, 0, Math.PI * 2);
      context.fill();

      return [size, context.getImageData(0, 0, size, size)] as const;
    })
  );

  return Object.fromEntries(entries);
}

async function loadActionIconBitmap(size: (typeof ACTION_ICON_SIZES)[number]): Promise<ImageBitmap> {
  const response = await fetch(chrome.runtime.getURL(`icons/icon-${size}.png`));

  if (!response.ok) {
    throw new Error(`Failed to load action icon ${size}px.`);
  }

  return createImageBitmap(await response.blob());
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
    browserState.idleState === "active" && !runtimeState.isManuallyPaused
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

  const nextRuntimeState = {
    activeSession: result.nextSession,
    focusedWindowId: browserState.focusedWindowId,
    isManuallyPaused: runtimeState.isManuallyPaused,
    idleState: browserState.idleState,
    updatedAtMs: nowMs
  };

  await saveRuntimeState(nextRuntimeState);
  await syncActionBadgeFromState(nextRuntimeState);

  console.debug(`Reconciled YouTube session after ${reason}.`);
}

async function clearManualPauseOnTabSwitch(): Promise<void> {
  const runtimeState = await loadRuntimeState();

  if (!runtimeState.isManuallyPaused) {
    return;
  }

  const nextRuntimeState = {
    ...runtimeState,
    isManuallyPaused: false,
    updatedAtMs: Date.now()
  };

  await saveRuntimeState(nextRuntimeState);
  await syncActionBadgeFromState(nextRuntimeState);
}

async function manuallyPauseTracking(): Promise<void> {
  const nowMs = Date.now();
  const runtimeState = await loadRuntimeState(nowMs);

  if (runtimeState.activeSession) {
    await appendTrackedDuration(runtimeState.activeSession.lastFlushedAtMs, nowMs);
  }

  const nextRuntimeState = {
    ...runtimeState,
    activeSession: null,
    isManuallyPaused: true,
    updatedAtMs: nowMs
  };

  await saveRuntimeState(nextRuntimeState);
  await syncActionBadgeFromState(nextRuntimeState);
}

async function manuallyResumeTracking(): Promise<void> {
  const runtimeState = await loadRuntimeState();
  const nextRuntimeState = {
    ...runtimeState,
    isManuallyPaused: false,
    updatedAtMs: Date.now()
  };

  await saveRuntimeState(nextRuntimeState);
  await syncActionBadgeFromState(nextRuntimeState);
  await reconcileCurrentBrowserState("resume-tracking");
}

async function toggleManualPauseTracking(): Promise<void> {
  const runtimeState = await loadRuntimeState();

  if (runtimeState.isManuallyPaused) {
    await manuallyResumeTracking();
    return;
  }

  await manuallyPauseTracking();
}

function scheduleReconcile(reason: string, options?: { clearManualPause?: boolean }) {
  enqueue(reason, async () => {
    chrome.idle.setDetectionInterval(IDLE_INTERVAL_SECONDS);
    await ensureHeartbeatAlarm();
    if (options?.clearManualPause) {
      await clearManualPauseOnTabSwitch();
    }
    await reconcileCurrentBrowserState(reason);
  });
}

chrome.runtime.onInstalled.addListener(() => {
  scheduleReconcile("runtime.onInstalled");
});

chrome.runtime.onStartup.addListener(() => {
  scheduleReconcile("runtime.onStartup");
});

chrome.runtime.onMessage.addListener((message: RuntimeMessage, _sender, sendResponse) => {
  enqueue(`runtime.onMessage:${message.type}`, async () => {
    if (message.type === "pause-tracking") {
      await manuallyPauseTracking();
    }

    if (message.type === "resume-tracking") {
      await manuallyResumeTracking();
    }

    if (message.type === "toggle-tracking") {
      await toggleManualPauseTracking();
    }

    sendResponse({ ok: true });
  });

  return true;
});

chrome.commands.onCommand.addListener((command) => {
  if (command !== TOGGLE_TRACKING_COMMAND) {
    return;
  }

  enqueue(`commands.onCommand:${command}`, async () => {
    await toggleManualPauseTracking();
  });
});

chrome.tabs.onActivated.addListener(() => {
  scheduleReconcile("tabs.onActivated", { clearManualPause: true });
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
