import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { build } from "esbuild";

import type { RuntimeState, StoredStats } from "../src/shared/types";

const bundlePromise = build({
  entryPoints: ["src/background.ts"], bundle: true, write: false, format: "cjs", platform: "node"
});

async function createWorker() {
  const bundle = await bundlePromise;
  let nowMs = 1_000;
  let failNextRuntimeSave = false;
  let failNextStatsSave = false;
  const localData: Record<string, unknown> = {};
  const sessionData: Record<string, unknown> = {};
  const errors: unknown[] = [];
  const listeners = new Map<string, (...args: unknown[]) => void>();
  const event = (name: string) => ({
    addListener(callback: (...args: unknown[]) => void) { listeners.set(name, callback); }
  });
  const area = (data: Record<string, unknown>, isRuntime: boolean) => ({
    async get(key: string) { return structuredClone({ [key]: data[key] }); },
    async set(update: Record<string, unknown>) {
      if (isRuntime && failNextRuntimeSave) {
        failNextRuntimeSave = false;
        throw new Error("Runtime save interrupted");
      }
      if (!isRuntime && failNextStatsSave) {
        failNextStatsSave = false;
        throw new Error("Stats save interrupted");
      }
      Object.assign(data, structuredClone(update));
    }
  });
  const chromeMock = {
    storage: { local: area(localData, false), session: area(sessionData, true) },
    runtime: {
      onInstalled: event("installed"), onStartup: event("startup"), onMessage: event("message"),
      getURL: (path: string) => path
    },
    tabs: {
      query: async () => [{ id: 7, windowId: 1, url: "https://youtube.com/" }],
      onActivated: event("activated"), onUpdated: event("updated"), onRemoved: event("removed")
    },
    windows: { getLastFocused: async () => ({ id: 1, focused: true }), onFocusChanged: event("focus") },
    idle: { queryState: async () => "active", setDetectionInterval() {}, onStateChanged: event("idle") },
    alarms: { get: async () => ({ name: "stats-heartbeat" }), create() {}, onAlarm: event("alarm") },
    commands: { onCommand: event("command") },
    action: { setBadgeText: async () => {}, setIcon: async () => {}, setTitle: async () => {} }
  };
  class Clock extends Date {
    static now() { return nowMs; }
  }
  class Canvas {
    getContext() {
      return { clearRect() {}, drawImage() {}, beginPath() {}, arc() {}, fill() {}, getImageData() { return {}; } };
    }
  }
  const drain = async () => {
    for (let i = 0; i < 10; i++) await new Promise<void>((resolve) => setImmediate(resolve));
  };
  const start = async () => {
    vm.runInNewContext(bundle.outputFiles[0].text, {
      chrome: chromeMock, Date: Clock, URL, OffscreenCanvas: Canvas,
      fetch: async () => ({ ok: true, blob: async () => ({}) }),
      createImageBitmap: async () => ({}),
      console: { debug() {}, error(...args: unknown[]) { errors.push(args); } }
    });
    await drain();
  };
  const emit = async (name: string, ...args: unknown[]) => {
    assert.ok(listeners.has(name));
    listeners.get(name)?.(...args);
    await drain();
  };
  await start();

  return {
    advance(ms: number) { nowMs += ms; },
    failRuntimeSave() { failNextRuntimeSave = true; },
    failStatsSave() { failNextStatsSave = true; },
    runtime: () => sessionData.runtimeState as RuntimeState,
    total: () => Object.values((localData.stats as StoredStats | undefined)?.dailyDurationsByDate ?? {})
      .reduce((sum, duration) => sum + duration, 0),
    heartbeat: () => emit("alarm", { name: "stats-heartbeat" }),
    restart: start,
    emit,
    errors
  };
}

test("worker skips device sleep and resumes counting from wake", async () => {
  const worker = await createWorker();
  worker.advance(8 * 60 * 60 * 1_000);
  await worker.heartbeat();
  assert.equal(worker.total(), 0);
  assert.equal(worker.runtime().activeSession?.startedAtMs, 1_000 + 8 * 60 * 60 * 1_000);

  worker.advance(30_000);
  await worker.heartbeat();
  assert.equal(worker.total(), 30_000);
});

test("committed stats are not counted twice after a runtime write fails and the worker restarts", async () => {
  const worker = await createWorker();
  worker.advance(30_000);
  worker.failRuntimeSave();
  await worker.heartbeat();
  assert.equal(worker.total(), 30_000);
  assert.equal(worker.runtime().activeSession?.lastFlushedAtMs, 1_000);
  assert.equal(worker.errors.length, 1);

  worker.advance(30_000);
  await worker.restart();
  assert.equal(worker.total(), 60_000);
  assert.equal(worker.runtime().activeSession?.lastFlushedAtMs, 61_000);
});

test("a failed stats write is retried without losing the pending interval", async () => {
  const worker = await createWorker();
  worker.advance(30_000);
  worker.failStatsSave();
  await worker.heartbeat();
  assert.equal(worker.total(), 0);
  assert.equal(worker.runtime().activeSession?.lastFlushedAtMs, 1_000);

  worker.advance(30_000);
  await worker.heartbeat();
  assert.equal(worker.total(), 60_000);
});

test("manual pause after a long gap does not flush sleeping time", async () => {
  const worker = await createWorker();
  worker.advance(8 * 60 * 60 * 1_000);
  await worker.emit("message", { type: "pause-tracking" }, {}, () => {});
  assert.equal(worker.total(), 0);
  assert.equal(worker.runtime().isManuallyPaused, true);
  assert.equal(worker.runtime().activeSession, null);

  await worker.emit("command", "toggle-tracking");
  assert.equal(worker.runtime().isManuallyPaused, false);
  worker.advance(30_000);
  await worker.heartbeat();
  assert.equal(worker.total(), 30_000);
});

test("queued idle events close the session even if the current query already reports active", async () => {
  const worker = await createWorker();
  worker.advance(5_000);
  await worker.emit("idle", "locked");
  assert.equal(worker.runtime().idleState, "locked");
  assert.equal(worker.runtime().activeSession, null);
  assert.equal(worker.total(), 5_000);

  worker.advance(10_000);
  await worker.emit("idle", "active");
  worker.advance(30_000);
  await worker.heartbeat();
  assert.equal(worker.total(), 35_000);
});
