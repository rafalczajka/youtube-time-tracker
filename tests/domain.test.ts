import assert from "node:assert/strict";
import test from "node:test";

import { getDomainKey, isTrackableUrl } from "../src/shared/domain";

test("groups subdomains into the registrable domain", () => {
  assert.equal(getDomainKey("https://docs.google.com/document/d/123"), "google.com");
});

test("falls back to the hostname for localhost", () => {
  assert.equal(getDomainKey("http://localhost:3000/dashboard"), "localhost");
});

test("ignores browser-internal and invalid URLs", () => {
  assert.equal(isTrackableUrl("chrome://extensions"), false);
  assert.equal(isTrackableUrl("about:blank"), false);
  assert.equal(getDomainKey("chrome-extension://abcdef/popup.html"), null);
  assert.equal(getDomainKey("not a url"), null);
});
