import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { build } from "esbuild";

const bundlePromise = build({
  entryPoints: ["src/popup.ts"], bundle: true, write: false, format: "cjs", platform: "node"
});

async function createPopup(shortcut: string) {
  const bundle = await bundlePromise;
  let assignedShortcut = shortcut;
  let messages = 0;
  const listeners = new Map<string, (event: unknown) => void>();
  const makeElement = () => ({
    textContent: "", hidden: false, dataset: {}, style: {}, classList: { add() {} },
    append() {}, replaceChildren() {}, addEventListener() {}
  });
  const elements = new Map<string, ReturnType<typeof makeElement>>();
  const runtimeState = {
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
      local: { get: async () => ({}) },
      session: { get: async () => ({ runtimeState: structuredClone(runtimeState) }) },
      onChanged: { addListener() {} }
    },
    commands: { getAll: async () => [{ name: "toggle-tracking", shortcut: assignedShortcut }] },
    runtime: {
      getManifest: () => ({ commands: { "toggle-tracking": { suggested_key: { default: "Alt+Shift+Y" } } } }),
      sendMessage: async () => {
        messages++;
        runtimeState.isManuallyPaused = !runtimeState.isManuallyPaused;
        return { ok: true };
      }
    }
  };
  const drain = async () => {
    for (let i = 0; i < 5; i++) await new Promise<void>((resolve) => setImmediate(resolve));
  };
  vm.runInNewContext(bundle.outputFiles[0].text, { document: documentMock, chrome: chromeMock, console });
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
    label: () => elements.get("#counting-label")?.textContent
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
  assert.equal(popup.label(), "Waiting");
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
