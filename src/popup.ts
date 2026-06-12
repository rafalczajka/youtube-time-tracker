import { STATS_STORAGE_KEY, getRecentDailySeries, getTodayDurationMs, hasTrackedHistory } from "./shared/stats";
import { TOGGLE_TRACKING_COMMAND, matchesCommandShortcut } from "./shared/commands";
import { loadRuntimeState, loadStoredStats } from "./shared/storage";
import { formatDuration } from "./shared/time";
import type { DailyChartPoint, RuntimeMessage, RuntimeState, StoredStats } from "./shared/types";

const countingIndicatorElement = document.querySelector<HTMLElement>("#counting-indicator");
const countingLabelElement = document.querySelector<HTMLElement>("#counting-label");
const todayTotalElement = document.querySelector<HTMLElement>("#today-total");
const historyChartElement = document.querySelector<HTMLElement>("#history-chart");
const chartEmptyStateElement = document.querySelector<HTMLElement>("#chart-empty-state");
const pauseToggleElement = document.querySelector<HTMLButtonElement>("#pause-toggle");
let toggleTrackingShortcut: string | null = null;

type CommandManifestEntry = {
  suggested_key?: string | Record<string, string>;
};

type ManifestWithCommands = chrome.runtime.ManifestV3 & {
  commands?: Record<string, CommandManifestEntry>;
};

function ensurePopupElements(): void {
  if (
    !countingIndicatorElement ||
    !countingLabelElement ||
    !todayTotalElement ||
    !historyChartElement ||
    !chartEmptyStateElement ||
    !pauseToggleElement
  ) {
    throw new Error("Popup elements are missing from popup.html.");
  }
}

function getStatusLabel(runtimeState: RuntimeState): string {
  if (runtimeState.isManuallyPaused) {
    return "Paused manually";
  }

  if (runtimeState.activeSession) {
    return "Counting";
  }

  if (runtimeState.idleState === "locked" || runtimeState.idleState === "idle") {
    return "Paused";
  }

  return "Waiting";
}

async function sendRuntimeMessage(message: RuntimeMessage): Promise<void> {
  await chrome.runtime.sendMessage(message);
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

function createChartColumn(point: DailyChartPoint, maxDurationMs: number): HTMLElement {
  const minBarHeightPx = 6;
  const maxBarHeightPx = 84;
  const columnElement = document.createElement("article");
  const trackElement = document.createElement("div");
  const barElement = document.createElement("div");
  const labelElement = document.createElement("span");
  const durationMs = point.durationMs;
  const barHeightPx =
    maxDurationMs <= 0
      ? minBarHeightPx
      : Math.max(minBarHeightPx, Math.round((durationMs / maxDurationMs) * maxBarHeightPx));

  columnElement.className = "chart-column";
  trackElement.className = "chart-track";
  barElement.className = "chart-bar";
  labelElement.className = "chart-label";
  columnElement.title = `${point.date}: ${formatDuration(durationMs)}`;

  if (point.isToday) {
    columnElement.classList.add("chart-column-today");
  }

  if (durationMs > 0) {
    barElement.dataset.state = "filled";
  } else {
    barElement.dataset.state = "empty";
  }

  barElement.style.height = `${barHeightPx}px`;
  labelElement.textContent = point.shortLabel;
  trackElement.append(barElement);
  columnElement.append(trackElement, labelElement);

  return columnElement;
}

function renderChart(stats: StoredStats, nowMs: number): void {
  if (!historyChartElement || !chartEmptyStateElement) {
    return;
  }

  const series = getRecentDailySeries(stats, 14, nowMs);
  const maxDurationMs = series.reduce((maxDuration, point) => Math.max(maxDuration, point.durationMs), 0);
  const hasHistory = hasTrackedHistory(stats, nowMs);

  historyChartElement.replaceChildren(...series.map((point) => createChartColumn(point, maxDurationMs)));
  historyChartElement.hidden = !hasHistory;
  chartEmptyStateElement.hidden = hasHistory;
}

function renderPopup(runtimeState: RuntimeState, stats: StoredStats): void {
  if (
    !countingIndicatorElement ||
    !countingLabelElement ||
    !todayTotalElement ||
    !historyChartElement ||
    !chartEmptyStateElement ||
    !pauseToggleElement
  ) {
    return;
  }

  const nowMs = Date.now();
  const isCounting = runtimeState.activeSession !== null && !runtimeState.isManuallyPaused;

  countingIndicatorElement.dataset.state = isCounting ? "active" : "inactive";
  countingLabelElement.textContent = getStatusLabel(runtimeState);
  todayTotalElement.textContent = formatDuration(getTodayDurationMs(stats, nowMs));
  pauseToggleElement.textContent = runtimeState.isManuallyPaused ? "Resume" : "Pause";
  renderChart(stats, nowMs);
}

async function refreshPopup(): Promise<void> {
  const { runtimeState, stats } = await loadPopupState();
  renderPopup(runtimeState, stats);
}

async function toggleTracking(): Promise<void> {
  await sendRuntimeMessage({ type: "toggle-tracking" });
  await refreshPopup();
}

async function loadToggleTrackingShortcut(): Promise<void> {
  try {
    const commands = await chrome.commands.getAll();
    const toggleCommand = commands.find((command) => command.name === TOGGLE_TRACKING_COMMAND);

    toggleTrackingShortcut = toggleCommand?.shortcut || getSuggestedToggleTrackingShortcut();
  } catch {
    toggleTrackingShortcut = getSuggestedToggleTrackingShortcut();
  }
}

function getSuggestedToggleTrackingShortcut(): string | null {
  const manifest = chrome.runtime.getManifest() as ManifestWithCommands;
  const suggestedKey = manifest.commands?.[TOGGLE_TRACKING_COMMAND]?.suggested_key;

  if (typeof suggestedKey === "string") {
    return suggestedKey;
  }

  if (!suggestedKey) {
    return null;
  }

  return isMacPlatform() ? (suggestedKey.mac ?? suggestedKey.default ?? null) : (suggestedKey.default ?? null);
}

function isMacPlatform(): boolean {
  return navigator.platform.toLowerCase().includes("mac");
}

ensurePopupElements();
void refreshPopup();
void loadToggleTrackingShortcut();

pauseToggleElement?.addEventListener("click", () => {
  void toggleTracking();
});

document.addEventListener("keydown", (event) => {
  if (!toggleTrackingShortcut || !matchesCommandShortcut(event, toggleTrackingShortcut)) {
    return;
  }

  event.preventDefault();
  void toggleTracking();
});

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
