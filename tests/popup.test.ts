import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { build } from "esbuild";
import { toLocalDateKey } from "../src/shared/time";
import type { IdleState, RuntimeState, StoredStats } from "../src/shared/types";

const bundlePromise = build({
  entryPoints: ["src/popup.ts"], bundle: true, write: false, format: "cjs", platform: "node"
});

async function createPopup(shortcut: string, refreshedIdleState: IdleState = "active") {
  const bundle = await bundlePromise;
  let assignedShortcut = shortcut;
  let messages = 0;
  let refreshRequests = 0;
  let nowMs = new Date(2026, 10, 20, 12).getTime();
  let stats: StoredStats | undefined;
  let tick: (() => void) | undefined;
  class Clock extends Date {
    static now() { return nowMs; }
  }
  const listeners = new Map<string, (event: unknown) => void>();
  const makeElement = () => ({
    textContent: "", hidden: false, dataset: {}, style: {}, classList: { add() {} },
    append() {}, replaceChildren() {}, addEventListener() {}
  });
  const elements = new Map<string, ReturnType<typeof makeElement>>();
  const runtimeState: RuntimeState = {
    activeSession: null, focusedWindowId: 1, isManuallyPaused: false, idleState: "active", updatedAtMs: 1_000
  };
  const documentMock = {
    hidden: false,
    querySelector(id: string) {
      if (!elements.has(id)) elements.set(id, makeElement());
      return elements.get(id);
    },
    createElement: makeElement,
    addEventListener(name: string, callback: (event: unknown) => void) { listeners.set(name, callback); }
  };
  const chromeMock = {
    storage: {
      local: { get: async () => ({ stats: structuredClone(stats) }) },
      session: { get: async () => ({ runtimeState: structuredClone(runtimeState) }) },
      onChanged: { addListener: (listener: (changes: object, area: string) => void) => {
        listeners.set("storage", () => listener({ stats: {} }, "local"));
      } }
    },
    commands: { getAll: async () => [{ name: "toggle-tracking", shortcut: assignedShortcut }] },
    runtime: {
      getManifest: () => ({ commands: { "toggle-tracking": { suggested_key: { default: "Alt+Shift+Y" } } } }),
      sendMessage: async ({ type }: { type: string }) => {
        if (type === "refresh-tracking") {
          refreshRequests++;
          runtimeState.idleState = refreshedIdleState;
          return { ok: true };
        }
        messages++;
        runtimeState.isManuallyPaused = !runtimeState.isManuallyPaused;
        return { ok: true };
      }
    }
  };
  const drain = async () => {
    for (let i = 0; i < 5; i++) await new Promise<void>((resolve) => setImmediate(resolve));
  };
  const windowMock = {
    setInterval(callback: () => void, intervalMs: number) {
      assert.equal(intervalMs, 1_000);
      tick = callback;
      return 1;
    },
    clearInterval() { tick = undefined; }
  };
  vm.runInNewContext(bundle.outputFiles[0].text, {
    document: documentMock, chrome: chromeMock, console, Date: Clock, window: windowMock
  });
  await drain();

  return {
    async keydown(key = "Y", repeat = false) {
      listeners.get("keydown")?.({
        key, repeat, altKey: true, ctrlKey: false, metaKey: false, shiftKey: true, preventDefault() {}
      });
      await drain();
    },
    async changeShortcut(value: string) {
      assignedShortcut = value;
      listeners.get("visibilitychange")?.({});
      await drain();
    },
    messages: () => messages,
    refreshRequests: () => refreshRequests,
    label: () => elements.get("#counting-label")?.textContent,
    total: () => elements.get("#today-total")?.textContent,
    isTicking: () => tick !== undefined,
    advance(ms: number) {
      nowMs += ms;
      tick?.();
    },
    async setTracking(state: Partial<RuntimeState>, nextStats?: StoredStats) {
      Object.assign(runtimeState, state);
      stats = nextStats;
      listeners.get("storage")?.({});
      await drain();
    },
    now: () => nowMs
  };
}

test("popup toggles once for a held shortcut and refreshes its status", async () => {
  const popup = await createPopup("Alt+Shift+Y");
  await popup.keydown();
  assert.equal(popup.label(), "Paused manually");
  await popup.keydown("Y", true);
  assert.equal(popup.messages(), 1);
  assert.equal(popup.label(), "Paused manually");
  await popup.keydown();
  assert.equal(popup.label(), "No YouTube tab");
});

test("popup does not fall back to the manifest when the shortcut has been unassigned", async () => {
  const popup = await createPopup("");
  await popup.keydown();
  assert.equal(popup.messages(), 0);
});

test("popup follows a remapped shortcut and notices it being removed", async () => {
  const popup = await createPopup("Alt+Shift+O");
  await popup.keydown("Y");
  assert.equal(popup.messages(), 0);
  await popup.keydown("O");
  assert.equal(popup.messages(), 1);
  await popup.changeShortcut("");
  await popup.keydown("O");
  assert.equal(popup.messages(), 1);
});

test("popup requests a fresh tracking state once and shows the reason for inactivity", async () => {
  const popup = await createPopup("", "idle");

  assert.equal(popup.refreshRequests(), 1);
  assert.equal(popup.label(), "Idle");
  await popup.changeShortcut("");
  assert.equal(popup.refreshRequests(), 1);
});

test("popup updates at minute boundaries, reconciles a checkpoint without a jump, and freezes on pause", async () => {
  const popup = await createPopup("");
  assert.equal(popup.total(), "0m");
  const startMs = popup.now();
  const session = { tabId: 7, windowId: 1, startedAtMs: startMs, lastFlushedAtMs: startMs };
  const date = toLocalDateKey(startMs);
  const stats: StoredStats = { version: 3, dailyDurationsByDate: { [date]: 59_000 }, updatedAtMs: startMs };
  await popup.setTracking({ activeSession: session }, stats);
  assert.equal(popup.total(), "<1m");
  popup.advance(1_000);
  assert.equal(popup.total(), "1m");
  popup.advance(30_000);
  assert.equal(popup.total(), "1m");

  const flushedStats = {
    ...stats,
    dailyDurationsByDate: { [date]: 90_000 },
    trackingCheckpoint: { ...session, endMs: popup.now() }
  };
  await popup.setTracking({}, flushedStats);
  assert.equal(popup.total(), "1m");
  await popup.setTracking({ activeSession: null, isManuallyPaused: true }, flushedStats);
  assert.equal(popup.isTicking(), false);
  popup.advance(60_000);
  assert.equal(popup.total(), "1m");
});
