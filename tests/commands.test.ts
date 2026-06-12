import assert from "node:assert/strict";
import test from "node:test";

import { parseCommandShortcut } from "../src/shared/commands";

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
