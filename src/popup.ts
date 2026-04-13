import { buildDomainRows, getTodayTotalMs, normalizeStoredStats, STATS_STORAGE_KEY } from "./shared/stats";
import { formatDuration } from "./shared/time";
import type { DomainStatsRow, StoredStats } from "./shared/types";

const MAX_ROWS = 10;

const domainListElement = document.querySelector<HTMLDivElement>("#domain-list");
const templateElement = document.querySelector<HTMLTemplateElement>("#domain-row-template");
const todayTotalElement = document.querySelector<HTMLElement>("#today-total");
const domainsTrackedElement = document.querySelector<HTMLElement>("#domains-tracked");
const updatedAtElement = document.querySelector<HTMLElement>("#updated-at");

const timeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: "numeric",
  minute: "2-digit"
});

function ensurePopupElements(): void {
  if (!domainListElement || !templateElement || !todayTotalElement || !domainsTrackedElement || !updatedAtElement) {
    throw new Error("Popup elements are missing from popup.html.");
  }
}

async function loadStats(): Promise<StoredStats> {
  const result = await chrome.storage.local.get(STATS_STORAGE_KEY);
  return normalizeStoredStats(result[STATS_STORAGE_KEY], Date.now());
}

function renderEmptyState(): void {
  if (!domainListElement) {
    return;
  }

  const emptyState = document.createElement("article");
  emptyState.className = "empty-state";
  emptyState.textContent =
    "No tracked browsing time yet. Open a website in the active browser window and this list will start filling in.";

  domainListElement.replaceChildren(emptyState);
}

function createRow(row: DomainStatsRow, index: number): HTMLElement {
  if (!templateElement) {
    throw new Error("Popup row template is missing.");
  }

  const fragment = templateElement.content.cloneNode(true) as DocumentFragment;
  const rowElement = fragment.querySelector<HTMLElement>(".domain-row");
  const rankElement = fragment.querySelector<HTMLElement>(".domain-rank");
  const nameElement = fragment.querySelector<HTMLElement>(".domain-name");
  const todayElement = fragment.querySelector<HTMLElement>(".domain-time-today");
  const totalElement = fragment.querySelector<HTMLElement>(".domain-time-total");

  if (!rowElement || !rankElement || !nameElement || !todayElement || !totalElement) {
    throw new Error("Popup row markup is incomplete.");
  }

  rankElement.textContent = `${index + 1}`;
  nameElement.textContent = row.domain;
  rowElement.title = `${row.domain}: ${formatDuration(row.todayMs)} today, ${formatDuration(row.totalMs)} total`;
  todayElement.textContent = formatDuration(row.todayMs);
  totalElement.textContent = formatDuration(row.totalMs);

  return rowElement;
}

function renderRows(stats: StoredStats): void {
  if (!domainListElement || !todayTotalElement || !domainsTrackedElement || !updatedAtElement) {
    return;
  }

  const rows = buildDomainRows(stats, Date.now()).slice(0, MAX_ROWS);
  const totalTrackedDomains = Object.keys(stats.totalsByDomain).length;

  todayTotalElement.textContent = formatDuration(getTodayTotalMs(stats, Date.now()));
  domainsTrackedElement.textContent = `${totalTrackedDomains} domain${totalTrackedDomains === 1 ? "" : "s"} tracked`;
  updatedAtElement.textContent =
    totalTrackedDomains === 0 ? "Waiting for data" : `Updated ${timeFormatter.format(stats.updatedAtMs)}`;

  if (rows.length === 0) {
    renderEmptyState();
    return;
  }

  domainListElement.replaceChildren(...rows.map((row, index) => createRow(row, index)));
}

async function refreshPopup(): Promise<void> {
  const stats = await loadStats();
  renderRows(stats);
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
