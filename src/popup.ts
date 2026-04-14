import { STATS_STORAGE_KEY, getRecentDailySeries, getTodayDurationMs, hasTrackedHistory } from "./shared/stats";
import { loadRuntimeState, loadStoredStats } from "./shared/storage";
import { formatDuration } from "./shared/time";
import type { DailyChartPoint, RuntimeState, StoredStats } from "./shared/types";

const countingIndicatorElement = document.querySelector<HTMLElement>("#counting-indicator");
const countingLabelElement = document.querySelector<HTMLElement>("#counting-label");
const todayTotalElement = document.querySelector<HTMLElement>("#today-total");
const historyChartElement = document.querySelector<HTMLElement>("#history-chart");
const chartEmptyStateElement = document.querySelector<HTMLElement>("#chart-empty-state");

function ensurePopupElements(): void {
  if (
    !countingIndicatorElement ||
    !countingLabelElement ||
    !todayTotalElement ||
    !historyChartElement ||
    !chartEmptyStateElement
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
    !chartEmptyStateElement
  ) {
    return;
  }

  const nowMs = Date.now();
  const isCounting = runtimeState.activeSession !== null;

  countingIndicatorElement.dataset.state = isCounting ? "active" : "inactive";
  countingLabelElement.textContent = isCounting ? "Counting" : "Paused";
  todayTotalElement.textContent = formatDuration(getTodayDurationMs(stats, nowMs));
  renderChart(stats, nowMs);
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
