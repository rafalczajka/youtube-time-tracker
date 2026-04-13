import { normalizeStoredStats, STATS_STORAGE_KEY } from "./shared/stats";
import { formatDuration } from "./shared/time";
import type { StoredStats } from "./shared/types";

const todayTotalElement = document.querySelector<HTMLElement>("#today-total");
const lifetimeTotalElement = document.querySelector<HTMLElement>("#lifetime-total");
const trackingStatusElement = document.querySelector<HTMLElement>("#tracking-status");
const updatedAtElement = document.querySelector<HTMLElement>("#updated-at");

const timeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: "numeric",
  minute: "2-digit"
});

function ensurePopupElements(): void {
  if (!todayTotalElement || !lifetimeTotalElement || !trackingStatusElement || !updatedAtElement) {
    throw new Error("Popup elements are missing from popup.html.");
  }
}

async function loadStats(): Promise<StoredStats> {
  const result = await chrome.storage.local.get(STATS_STORAGE_KEY);
  return normalizeStoredStats(result[STATS_STORAGE_KEY], Date.now());
}

function renderStats(stats: StoredStats): void {
  if (!todayTotalElement || !lifetimeTotalElement || !trackingStatusElement || !updatedAtElement) {
    return;
  }

  const hasTrackedTime = stats.totalMs > 0 || stats.today.durationMs > 0;
  todayTotalElement.textContent = formatDuration(stats.today.durationMs);
  lifetimeTotalElement.textContent = formatDuration(stats.totalMs);
  trackingStatusElement.textContent = hasTrackedTime
    ? "Tracking active YouTube tab time"
    : "Open YouTube to start tracking";
  updatedAtElement.textContent = hasTrackedTime ? `Updated ${timeFormatter.format(stats.updatedAtMs)}` : "Waiting for data";
}

async function refreshPopup(): Promise<void> {
  const stats = await loadStats();
  renderStats(stats);
}

ensurePopupElements();
void refreshPopup();

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local" && changes[STATS_STORAGE_KEY]) {
    void refreshPopup();
  }
});

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    void refreshPopup();
  }
});
