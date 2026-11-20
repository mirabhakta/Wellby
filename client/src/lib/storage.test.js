import test from "node:test";
import assert from "node:assert/strict";
import { clearWellbyStorage } from "./storage.js";

function createStorage(entries) {
  const map = new Map(Object.entries(entries));

  return {
    get length() {
      return map.size;
    },
    key(index) {
      return Array.from(map.keys())[index] ?? null;
    },
    removeItem(key) {
      map.delete(key);
    },
    has(key) {
      return map.has(key);
    }
  };
}

test("clearWellbyStorage removes only this app's keys", () => {
  const storage = createStorage({
    "wellby.profile": "{}",
    "wellby.sessions": "[]",
    "wellby-theme": "warm",
    "other.key": "keep me"
  });

  assert.equal(clearWellbyStorage(storage), 3);
  assert.equal(storage.has("wellby.profile"), false);
  assert.equal(storage.has("wellby.sessions"), false);
  assert.equal(storage.has("wellby-theme"), false);
  assert.equal(storage.has("other.key"), true);
});

test("clearWellbyStorage is safe with nothing to remove", () => {
  const storage = createStorage({ "other.key": "keep me" });

  assert.equal(clearWellbyStorage(storage), 0);
  assert.equal(clearWellbyStorage(undefined), 0);
});
