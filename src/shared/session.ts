import type {
  ActiveSession,
  CountableContext,
  SessionFlush,
  SessionReconcileResult
} from "./types";

export const MAX_SESSION_GAP_MS = 90_000;

interface ReconcileSessionInput {
  session: ActiveSession | null;
  context: CountableContext | null;
  nowMs: number;
}

function sameContext(session: ActiveSession, context: CountableContext): boolean {
  return session.tabId === context.tabId && session.windowId === context.windowId;
}

function createSession(context: CountableContext, nowMs: number): ActiveSession {
  return {
    ...context,
    startedAtMs: nowMs,
    lastFlushedAtMs: nowMs
  };
}

function buildFlush(session: ActiveSession, nowMs: number): SessionFlush | null {
  const effectiveNowMs = Math.max(nowMs, session.lastFlushedAtMs);

  if (effectiveNowMs <= session.lastFlushedAtMs) {
    return null;
  }

  return {
    startMs: session.lastFlushedAtMs,
    endMs: effectiveNowMs
  };
}

export function reconcileSession({
  session,
  context,
  nowMs
}: ReconcileSessionInput): SessionReconcileResult {
  // A missed heartbeat may span device sleep; do not bill an unobserved gap.
  if (session && nowMs - session.lastFlushedAtMs > MAX_SESSION_GAP_MS) {
    return {
      nextSession: context ? createSession(context, nowMs) : null,
      flushedDuration: null
    };
  }

  if (!session && !context) {
    return {
      nextSession: null,
      flushedDuration: null
    };
  }

  if (!session && context) {
    return {
      nextSession: createSession(context, nowMs),
      flushedDuration: null
    };
  }

  if (session && !context) {
    return {
      nextSession: null,
      flushedDuration: buildFlush(session, nowMs)
    };
  }

  if (!session || !context) {
    return {
      nextSession: null,
      flushedDuration: null
    };
  }

  const effectiveNowMs = Math.max(nowMs, session.lastFlushedAtMs);
  const flushedDuration = buildFlush(session, effectiveNowMs);

  if (sameContext(session, context)) {
    return {
      nextSession: {
        ...session,
        lastFlushedAtMs: effectiveNowMs
      },
      flushedDuration
    };
  }

  return {
    nextSession: createSession(context, effectiveNowMs),
    flushedDuration
  };
}
