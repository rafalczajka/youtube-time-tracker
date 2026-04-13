import { getDomain } from "tldts";

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

export function getDomainKey(urlValue: string | null | undefined): string | null {
  if (!isTrackableUrl(urlValue)) {
    return null;
  }

  const url = new URL(urlValue as string);
  const hostname = url.hostname.toLowerCase();
  const registrableDomain = getDomain(hostname, { allowPrivateDomains: true });

  return (registrableDomain ?? hostname).toLowerCase();
}
