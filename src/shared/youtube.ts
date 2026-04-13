import type { ActiveSession, CountableContext } from "./types";

const TRACKABLE_PROTOCOLS = new Set(["http:", "https:"]);

interface TabLike {
  id?: number;
  windowId?: number;
  url?: string | null;
}

export function isTrackableUrl(urlValue: string | null | undefined): boolean {
  if (!urlValue) {
    return false;
  }

  try {
    const url = new URL(urlValue);
    return TRACKABLE_PROTOCOLS.has(url.protocol) && url.hostname.length > 0;
  } catch {
    return false;
  }
}

export function isYouTubeUrl(urlValue: string | null | undefined): boolean {
  if (!isTrackableUrl(urlValue)) {
    return false;
  }

  const url = new URL(urlValue as string);
  const hostname = url.hostname.toLowerCase();

  return hostname === "youtube.com" || hostname.endsWith(".youtube.com");
}

export function extractActiveYouTubeContexts(tabs: readonly TabLike[]): CountableContext[] {
  return tabs
    .filter(
      (tab): tab is Required<Pick<TabLike, "id" | "windowId">> & TabLike =>
        typeof tab.id === "number" && typeof tab.windowId === "number" && isYouTubeUrl(tab.url ?? null)
    )
    .map((tab) => ({
      tabId: tab.id,
      windowId: tab.windowId
    }))
    .sort((left, right) => left.windowId - right.windowId || left.tabId - right.tabId);
}

function sameContext(left: CountableContext, right: CountableContext): boolean {
  return left.tabId === right.tabId && left.windowId === right.windowId;
}

export function pickCountableContext(
  contexts: readonly CountableContext[],
  preferredSession: ActiveSession | null,
  focusedWindowId: number | null
): CountableContext | null {
  if (contexts.length === 0) {
    return null;
  }

  if (preferredSession) {
    const existingContext = contexts.find((context) => sameContext(context, preferredSession));

    if (existingContext) {
      return existingContext;
    }
  }

  if (focusedWindowId !== null) {
    const focusedContext = contexts.find((context) => context.windowId === focusedWindowId);

    if (focusedContext) {
      return focusedContext;
    }
  }

  return contexts[0];
}
