export const TOGGLE_TRACKING_COMMAND = "toggle-tracking";

interface CommandShortcut {
  altKey: boolean;
  ctrlKey: boolean;
  key: string;
  metaKey: boolean;
  shiftKey: boolean;
}

const KEY_ALIASES: Record<string, string> = {
  comma: ",",
  down: "arrowdown",
  left: "arrowleft",
  period: ".",
  right: "arrowright",
  space: " ",
  up: "arrowup"
};

function normalizeShortcutKey(value: string): string {
  const key = value.trim().toLowerCase();
  return KEY_ALIASES[key] ?? key;
}

export function parseCommandShortcut(shortcut: string): CommandShortcut | null {
  const parts = shortcut
    .split("+")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length === 0) {
    return null;
  }

  const parsedShortcut: Partial<CommandShortcut> = {
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false
  };

  for (const part of parts) {
    const normalizedPart = part.toLowerCase();

    if (normalizedPart === "alt" || normalizedPart === "option") {
      parsedShortcut.altKey = true;
      continue;
    }

    if (normalizedPart === "command" || normalizedPart === "cmd" || normalizedPart === "meta") {
      parsedShortcut.metaKey = true;
      continue;
    }

    if (normalizedPart === "ctrl" || normalizedPart === "control" || normalizedPart === "macctrl") {
      parsedShortcut.ctrlKey = true;
      continue;
    }

    if (normalizedPart === "shift") {
      parsedShortcut.shiftKey = true;
      continue;
    }

    if (parsedShortcut.key) {
      return null;
    }

    parsedShortcut.key = normalizeShortcutKey(part);
  }

  return typeof parsedShortcut.key === "string" ? (parsedShortcut as CommandShortcut) : null;
}

export function matchesCommandShortcut(event: KeyboardEvent, shortcut: string): boolean {
  const parsedShortcut = parseCommandShortcut(shortcut);

  if (!parsedShortcut) {
    return false;
  }

  return (
    event.altKey === parsedShortcut.altKey &&
    event.ctrlKey === parsedShortcut.ctrlKey &&
    normalizeShortcutKey(event.key) === parsedShortcut.key &&
    event.metaKey === parsedShortcut.metaKey &&
    event.shiftKey === parsedShortcut.shiftKey
  );
}
