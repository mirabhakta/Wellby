import test from "node:test";
import assert from "node:assert/strict";
import { FORCED_BREAK_COOLDOWN_MS, isBreakCoolingDown } from "./alerts.js";

const NOW = 1_760_000_000_000;

test("no previous break means the cooldown is not active", () => {
  assert.equal(isBreakCoolingDown({ now: NOW, lastBreakAt: 0 }), false);
});

test("a break just completed keeps the cooldown active", () => {
  assert.equal(isBreakCoolingDown({ now: NOW, lastBreakAt: NOW - 1_000 }), true);
});

test("the cooldown expires exactly at the cooldown boundary", () => {
  assert.equal(
    isBreakCoolingDown({ now: NOW, lastBreakAt: NOW - FORCED_BREAK_COOLDOWN_MS }),
    false
  );
});

test("the cooldown is inactive after the window", () => {
  assert.equal(
    isBreakCoolingDown({ now: NOW, lastBreakAt: NOW - FORCED_BREAK_COOLDOWN_MS - 1 }),
    false
  );
});

test("a future timestamp from clock skew still counts as cooling down", () => {
  assert.equal(isBreakCoolingDown({ now: NOW, lastBreakAt: NOW + 60_000 }), true);
});

test("the cooldown window is ten minutes", () => {
  assert.equal(FORCED_BREAK_COOLDOWN_MS, 10 * 60 * 1000);
});
