import type {
  ActiveSession,
  CountableContext,
  SessionFlush,
  SessionReconcileResult
} from "./types";

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
