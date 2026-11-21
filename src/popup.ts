import { STATS_STORAGE_KEY, getLiveTodayDurationMs, getRecentDailySeries, hasTrackedHistory } from "./shared/stats";
import { getActionBadgeState } from "./shared/action-badge";
import { TOGGLE_TRACKING_COMMAND, matchesCommandShortcut } from "./shared/commands";
import { loadRuntimeState, loadStoredStats } from "./shared/storage";
import { formatDuration, formatTodayDuration } from "./shared/time";
import type { DailyChartPoint, RuntimeMessage, RuntimeState, StoredStats } from "./shared/types";

const HOUR_MS = 3_600_000;
const TODAY_REFRESH_MS = 1_000;

interface PopupState {
  runtimeState: RuntimeState;
  stats: StoredStats;
}

const countingIndicatorElement = document.querySelector<HTMLElement>("#counting-indicator");
const countingLabelElement = document.querySelector<HTMLElement>("#counting-label");
const todayTotalElement = document.querySelector<HTMLElement>("#today-total");
const historyChartElement = document.querySelector<HTMLElement>("#history-chart");
const chartEmptyStateElement = document.querySelector<HTMLElement>("#chart-empty-state");
const pauseToggleElement = document.querySelector<HTMLButtonElement>("#pause-toggle");
let toggleTrackingShortcut: string | null = null;
let popupState: PopupState | undefined;
let todayTimer: number | undefined;
let refreshId = 0;

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

async function sendRuntimeMessage(message: RuntimeMessage): Promise<void> {
  const response = await chrome.runtime.sendMessage(message);

  if (response?.ok !== true) {
    throw new Error(`Tracking request failed: ${message.type}`);
  }
}

async function loadPopupState(): Promise<PopupState> {
  const nowMs = Date.now();
  // The worker saves stats before advancing the session. Read in reverse order
  // so a newer session cursor never gets paired with older stats.
  const runtimeState = await loadRuntimeState(nowMs);
  const stats = await loadStoredStats(nowMs);

  return {
    runtimeState,
    stats
  };
}

function getChartTickIntervalMs(maxDurationMs: number): number {
  const halfDaySeconds = 43_200;
  const tickIntervalsSeconds = [
    1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1_800,
    3_600, 7_200, 10_800, 21_600, halfDaySeconds
  ];
  const halfRangeSeconds = maxDurationMs / 2_000;
  const intervalSeconds = tickIntervalsSeconds.find((interval) => interval >= halfRangeSeconds)
    ?? Math.ceil(halfRangeSeconds / halfDaySeconds) * halfDaySeconds;

  return intervalSeconds * 1_000;
}

function createChartColumn(point: DailyChartPoint, axisMaxMs: number): HTMLElement {
  const columnElement = document.createElement("article");
  const trackElement = document.createElement("div");
  const barElement = document.createElement("div");
  const labelElement = document.createElement("span");
  const durationMs = point.durationMs;

  columnElement.className = "chart-column";
  trackElement.className = "chart-track";
  barElement.className = "chart-bar";
  labelElement.className = "chart-label";
  columnElement.title = `${point.date}: ${formatDuration(durationMs)}`;

  if (point.isToday) {
    columnElement.classList.add("chart-column-today");
  }

  barElement.dataset.state = durationMs > 0 ? "filled" : "empty";
  barElement.style.height = `${(durationMs / axisMaxMs) * 100}%`;
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

  historyChartElement.hidden = !hasHistory;
  chartEmptyStateElement.hidden = hasHistory;

  if (!hasHistory) {
    historyChartElement.replaceChildren();
    return;
  }

  const intervalMs = getChartTickIntervalMs(maxDurationMs || 120_000);
  const axisMaxMs = 2 * intervalMs;
  const axis = document.createElement("div");
  axis.className = "chart-axis";
  const tickLabels = [axisMaxMs, intervalMs].map((durationMs) =>
    durationMs % HOUR_MS === 0 ? `${durationMs / HOUR_MS}h` : formatDuration(durationMs)
  );
  for (const label of [...tickLabels, "0"]) {
    const tick = document.createElement("span");
    tick.textContent = label;
    axis.append(tick);
  }

  const bars = document.createElement("div");
  bars.className = "chart-bars";
  bars.append(...series.map((point) => createChartColumn(point, axisMaxMs)));
  historyChartElement.replaceChildren(axis, bars);
}

function renderTodayTotal(nowMs = Date.now()): void {
  if (!todayTotalElement || !popupState) {
    return;
  }

  const { runtimeState, stats } = popupState;
  const { isCounting } = getActionBadgeState(runtimeState);
  const session = isCounting ? runtimeState.activeSession : null;
  const text = formatTodayDuration(getLiveTodayDurationMs(stats, session, nowMs));

  if (todayTotalElement.textContent !== text) {
    todayTotalElement.textContent = text;
  }
}

function updateTodayTimer(isCounting: boolean): void {
  if (isCounting && !document.hidden) {
    todayTimer ??= window.setInterval(renderTodayTotal, TODAY_REFRESH_MS);
  } else if (todayTimer !== undefined) {
    window.clearInterval(todayTimer);
    todayTimer = undefined;
  }
}

function renderPopup({ runtimeState, stats }: PopupState): void {
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
  const { isCounting, label } = getActionBadgeState(runtimeState);

  countingIndicatorElement.dataset.state = isCounting ? "active" : "inactive";
  countingLabelElement.textContent = label;
  renderTodayTotal(nowMs);
  updateTodayTimer(isCounting);
  pauseToggleElement.textContent = runtimeState.isManuallyPaused ? "Resume" : "Pause";
  renderChart(stats, nowMs);
}

async function refreshPopup(): Promise<void> {
  const id = ++refreshId;
  const state = await loadPopupState();
  if (id === refreshId) {
    popupState = state;
    renderPopup(state);
  }
}

async function initializePopup(): Promise<void> {
  try {
    await sendRuntimeMessage({ type: "refresh-tracking" });
  } catch (error) {
    console.error("Failed to refresh tracking on popup open:", error);
  }
  await refreshPopup();
}

async function toggleTracking(): Promise<void> {
  try {
    await sendRuntimeMessage({ type: "toggle-tracking" });
  } catch (error) {
    console.error("Failed to toggle tracking:", error);
  }
  await refreshPopup();
}

async function loadToggleTrackingShortcut(): Promise<void> {
  try {
    const commands = await chrome.commands.getAll();
    const toggleCommand = commands.find((command) => command.name === TOGGLE_TRACKING_COMMAND);

    toggleTrackingShortcut = toggleCommand?.shortcut || null;
  } catch (error) {
    toggleTrackingShortcut = null;
    console.error("Failed to load the tracking shortcut:", error);
  }
}

ensurePopupElements();

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
  if (document.hidden) {
    updateTodayTimer(false);
    return;
  }
  void refreshPopup();
  void loadToggleTrackingShortcut();
});

void initializePopup();
void loadToggleTrackingShortcut();
