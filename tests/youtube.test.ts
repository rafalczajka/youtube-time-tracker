import assert from "node:assert/strict";
import test from "node:test";

import { extractActiveYouTubeContexts, isTrackableUrl, isYouTubeUrl, pickCountableContext } from "../src/shared/youtube";

test("counts regular YouTube pages", () => {
  assert.equal(isYouTubeUrl("https://www.youtube.com/watch?v=123"), true);
  assert.equal(isYouTubeUrl("https://youtube.com/results?search_query=music"), true);
});

test("counts YouTube subdomains", () => {
  assert.equal(isYouTubeUrl("https://music.youtube.com/"), true);
  assert.equal(isYouTubeUrl("https://studio.youtube.com/channel/123"), true);
});

test("rejects non-YouTube or non-trackable URLs", () => {
  assert.equal(isTrackableUrl("chrome://extensions"), false);
  assert.equal(isTrackableUrl("about:blank"), false);
  assert.equal(isYouTubeUrl("https://youtu.be/abc123"), false);
  assert.equal(isYouTubeUrl("https://google.com"), false);
  assert.equal(isYouTubeUrl("not a url"), false);
});

test("extracts active YouTube contexts from tabs across browser windows", () => {
  const contexts = extractActiveYouTubeContexts([
    {
      id: 7,
      windowId: 4,
      url: "https://music.youtube.com/"
    },
    {
      id: 3,
      windowId: 2,
      url: "https://google.com"
    },
    {
      id: 2,
      windowId: 1,
      url: "https://www.youtube.com/watch?v=123"
    }
  ]);

  assert.deepEqual(contexts, [
    {
      tabId: 2,
      windowId: 1
    },
    {
      tabId: 7,
      windowId: 4
    }
  ]);
});

test("prefers the current tracked session when multiple active YouTube windows exist", () => {
  const context = pickCountableContext(
    [
      {
        tabId: 2,
        windowId: 1
      },
      {
        tabId: 7,
        windowId: 4
      }
    ],
    {
      tabId: 7,
      windowId: 4,
      startedAtMs: 1_000,
      lastFlushedAtMs: 1_500
    },
    null
  );

  assert.deepEqual(context, {
    tabId: 7,
    windowId: 4
  });
});

test("falls back to a focused YouTube window, then the first available context", () => {
  const contexts = [
    {
      tabId: 2,
      windowId: 1
    },
    {
      tabId: 7,
      windowId: 4
    }
  ];

  assert.deepEqual(pickCountableContext(contexts, null, 4), {
    tabId: 7,
    windowId: 4
  });
  assert.deepEqual(pickCountableContext(contexts, null, null), {
    tabId: 2,
    windowId: 1
  });
});
