import assert from "node:assert/strict";
import test from "node:test";

import { isTrackableUrl, isYouTubeUrl } from "../src/shared/youtube";

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
