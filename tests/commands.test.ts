import assert from "node:assert/strict";
import test from "node:test";

import { matchesCommandShortcut, parseCommandShortcut } from "../src/shared/commands";

function keyboardEvent(overrides: Partial<KeyboardEvent> = {}): KeyboardEvent {
  return {
    key: "Y", altKey: true, ctrlKey: false, shiftKey: true, metaKey: false, repeat: false,
    ...overrides
  } as KeyboardEvent;
}

test("parses a Chrome command shortcut with ctrl and shift", () => {
  assert.deepEqual(parseCommandShortcut("Ctrl+Shift+O"), {
    altKey: false,
    ctrlKey: true,
    key: "o",
    metaKey: false,
    shiftKey: true
  });
});

test("parses a Chrome command shortcut with command on macOS", () => {
  assert.deepEqual(parseCommandShortcut("Command+Shift+O"), {
    altKey: false,
    ctrlKey: false,
    key: "o",
    metaKey: true,
    shiftKey: true
  });
});

test("rejects shortcuts with multiple non-modifier keys", () => {
  assert.equal(parseCommandShortcut("Ctrl+O+P"), null);
});

test("matches the configured shortcut and rejects extra modifiers", () => {
  assert.equal(matchesCommandShortcut(keyboardEvent(), "Alt+Shift+Y"), true);
  assert.equal(matchesCommandShortcut(keyboardEvent({ ctrlKey: true }), "Alt+Shift+Y"), false);
  assert.equal(matchesCommandShortcut(keyboardEvent({ key: "O" }), "Alt+Shift+O"), true);
});

test("does not toggle again when a held key repeats", () => {
  assert.equal(matchesCommandShortcut(keyboardEvent({ repeat: true }), "Alt+Shift+Y"), false);
});

test("matches Space and punctuation shortcuts", () => {
  assert.equal(matchesCommandShortcut(keyboardEvent({ key: " ", altKey: false, ctrlKey: true }), "Ctrl+Shift+Space"), true);
  assert.equal(matchesCommandShortcut(keyboardEvent({ key: "," }), "Alt+Shift+Comma"), true);
  assert.equal(matchesCommandShortcut(keyboardEvent({ key: "ArrowUp" }), "Alt+Shift+Up"), true);
});
