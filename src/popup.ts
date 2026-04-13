import { STATS_STORAGE_KEY } from "./shared/stats";
import { loadRuntimeState, loadStoredStats } from "./shared/storage";
import { formatDuration } from "./shared/time";
import type { RuntimeState, StoredStats } from "./shared/types";

const countingIndicatorElement = document.querySelector<HTMLElement>("#counting-indicator");
const countingLabelElement = document.querySelector<HTMLElement>("#counting-label");
const todayTotalElement = document.querySelector<HTMLElement>("#today-total");
const lifetimeTotalElement = document.querySelector<HTMLElement>("#lifetime-total");
const trackingStatusElement = document.querySelector<HTMLElement>("#tracking-status");
const updatedAtElement = document.querySelector<HTMLElement>("#updated-at");

const timeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: "numeric",
  minute: "2-digit"
});

function ensurePopupElements(): void {
  if (
    !countingIndicatorElement ||
    !countingLabelElement ||
    !todayTotalElement ||
    !lifetimeTotalElement ||
    !trackingStatusElement ||
    !updatedAtElement
  ) {
    throw new Error("Popup elements are missing from popup.html.");
  }
}

async function loadPopupState(): Promise<{
  runtimeState: RuntimeState;
  stats: StoredStats;
}> {
  const nowMs = Date.now();
  const [runtimeState, stats] = await Promise.all([loadRuntimeState(nowMs), loadStoredStats(nowMs)]);

  return {
    runtimeState,
    stats
  };
}

function getTrackingStatusCopy(runtimeState: RuntimeState, hasTrackedTime: boolean): string {
  if (runtimeState.activeSession) {
    return "Currently tracking the active YouTube tab.";
  }

  if (runtimeState.idleState === "locked") {
    return "Paused because the device is locked.";
  }

  if (runtimeState.idleState === "idle") {
    return "Paused because you are idle.";
  }

  if (runtimeState.focusedWindowId === null) {
    return "Paused because the browser window is not focused.";
  }

  return hasTrackedTime ? "Open YouTube in the active tab to resume counting." : "Open YouTube to start tracking.";
}

function renderPopup(runtimeState: RuntimeState, stats: StoredStats): void {
  if (
    !countingIndicatorElement ||
    !countingLabelElement ||
    !todayTotalElement ||
    !lifetimeTotalElement ||
    !trackingStatusElement ||
    !updatedAtElement
  ) {
    return;
  }

  const hasTrackedTime = stats.totalMs > 0 || stats.today.durationMs > 0;
  const isCounting = runtimeState.activeSession !== null;

  countingIndicatorElement.dataset.state = isCounting ? "active" : "inactive";
  countingLabelElement.textContent = isCounting ? "Counting now" : "Not counting";
  todayTotalElement.textContent = formatDuration(stats.today.durationMs);
  lifetimeTotalElement.textContent = formatDuration(stats.totalMs);
  trackingStatusElement.textContent = getTrackingStatusCopy(runtimeState, hasTrackedTime);
  updatedAtElement.textContent = hasTrackedTime ? `Updated ${timeFormatter.format(stats.updatedAtMs)}` : "Waiting for data";
}

async function refreshPopup(): Promise<void> {
  const { runtimeState, stats } = await loadPopupState();
  renderPopup(runtimeState, stats);
}

ensurePopupElements();
void refreshPopup();

chrome.storage.onChanged.addListener((changes, areaName) => {
  if ((areaName === "local" && changes[STATS_STORAGE_KEY]) || areaName === "session") {
    void refreshPopup();
  }
});

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    void refreshPopup();
  }
});
