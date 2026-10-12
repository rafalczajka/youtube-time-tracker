import assert from "node:assert/strict";
import test from "node:test";

import { MAX_SESSION_GAP_MS, reconcileSession } from "../src/shared/session";

test("flushes elapsed time and keeps the session open on heartbeat for the same tab", () => {
  const result = reconcileSession({
    session: {
      tabId: 7,
      windowId: 1,
      startedAtMs: 1_000,
      lastFlushedAtMs: 1_000
    },
    context: {
      tabId: 7,
      windowId: 1
    },
    nowMs: 4_000
  });

  assert.deepEqual(result.flushedDuration, {
    startMs: 1_000,
    endMs: 4_000
  });
  assert.equal(result.nextSession?.lastFlushedAtMs, 4_000);
  assert.equal(result.nextSession?.startedAtMs, 1_000);
});

test("flushes and closes the session when focus or active context disappears", () => {
  const result = reconcileSession({
    session: {
      tabId: 7,
      windowId: 1,
      startedAtMs: 1_000,
      lastFlushedAtMs: 2_000
    },
    context: null,
    nowMs: 5_500
  });

  assert.deepEqual(result.flushedDuration, {
    startMs: 2_000,
    endMs: 5_500
  });
  assert.equal(result.nextSession, null);
});

test("flushes the old session and starts a new one when switching to another YouTube tab", () => {
  const result = reconcileSession({
    session: {
      tabId: 7,
      windowId: 1,
      startedAtMs: 1_000,
      lastFlushedAtMs: 3_000
    },
    context: {
      tabId: 11,
      windowId: 1
    },
    nowMs: 8_000
  });

  assert.deepEqual(result.flushedDuration, {
    startMs: 3_000,
    endMs: 8_000
  });
  assert.deepEqual(result.nextSession, {
    tabId: 11,
    windowId: 1,
    startedAtMs: 8_000,
    lastFlushedAtMs: 8_000
  });
});

test("skips an unobserved sleep gap and starts a fresh session at wake time", () => {
  const wakeMs = 1_000 + 8 * 60 * 60 * 1_000;
  const result = reconcileSession({
    session: { tabId: 7, windowId: 1, startedAtMs: 1_000, lastFlushedAtMs: 1_000 },
    context: { tabId: 7, windowId: 1 },
    nowMs: wakeMs
  });

  assert.equal(result.flushedDuration, null);
  assert.deepEqual(result.nextSession, {
    tabId: 7, windowId: 1, startedAtMs: wakeMs, lastFlushedAtMs: wakeMs
  });

  const heartbeat = reconcileSession({
    session: result.nextSession,
    context: { tabId: 7, windowId: 1 },
    nowMs: wakeMs + 30_000
  });
  assert.deepEqual(heartbeat.flushedDuration, { startMs: wakeMs, endMs: wakeMs + 30_000 });
});

test("closes a stale session without counting the gap on pause or idle", () => {
  const result = reconcileSession({
    session: { tabId: 7, windowId: 1, startedAtMs: 1_000, lastFlushedAtMs: 1_000 },
    context: null,
    nowMs: 1_000 + MAX_SESSION_GAP_MS + 1
  });

  assert.equal(result.nextSession, null);
  assert.equal(result.flushedDuration, null);
});

test("still counts a heartbeat delayed up to the tolerated gap", () => {
  const result = reconcileSession({
    session: { tabId: 7, windowId: 1, startedAtMs: 1_000, lastFlushedAtMs: 1_000 },
    context: { tabId: 7, windowId: 1 },
    nowMs: 1_000 + MAX_SESSION_GAP_MS
  });

  assert.deepEqual(result.flushedDuration, { startMs: 1_000, endMs: 1_000 + MAX_SESSION_GAP_MS });
});
