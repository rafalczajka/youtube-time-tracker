const TRACKABLE_PROTOCOLS = new Set(["http:", "https:"]);

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
