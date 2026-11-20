import test from "node:test";
import assert from "node:assert/strict";
import {
  FORCED_BREAK_COOLDOWN_MS,
  SNOOZE_MS,
  getAlertAction,
  isBreakCoolingDown
} from "./alerts.js";

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

const baseAlert = {
  burnRate: 0.45,
  fatigueDetected: false,
  notificationState: null,
  snoozeCount: 0,
  snoozedUntil: 0,
  lastBreakAt: 0,
  now: NOW
};

test("a sustainable reading clears any open alert", () => {
  assert.equal(getAlertAction({ ...baseAlert, burnRate: 0.2 }).type, "clear");
});

test("the mild threshold is inclusive", () => {
  assert.equal(getAlertAction({ ...baseAlert, burnRate: 0.3 }).type, "mild");
});

test("a mild reading shows a toast when nothing is open", () => {
  assert.deepEqual(getAlertAction(baseAlert), { type: "mild" });
});

test("an open toast is not duplicated", () => {
  assert.equal(
    getAlertAction({ ...baseAlert, notificationState: "mild" }).type,
    "none"
  );
});

test("a snoozed alert stays quiet during the snooze window", () => {
  assert.equal(
    getAlertAction({ ...baseAlert, snoozedUntil: NOW + SNOOZE_MS }).type,
    "none"
  );
});

test("a snoozed alert returns once the snooze window ends", () => {
  assert.equal(
    getAlertAction({ ...baseAlert, snoozedUntil: NOW - 1 }).type,
    "mild"
  );
});

test("two snoozes escalate to a full break after the last window", () => {
  assert.deepEqual(getAlertAction({ ...baseAlert, snoozeCount: 2 }), {
    type: "force-break",
    noSnooze: false,
    reason: "mild-escalation"
  });
});

test("escalation still respects the active snooze window", () => {
  assert.equal(
    getAlertAction({ ...baseAlert, snoozeCount: 2, snoozedUntil: NOW + 1 }).type,
    "none"
  );
});

test("a high reading forces break mode", () => {
  assert.deepEqual(getAlertAction({ ...baseAlert, burnRate: 0.75 }), {
    type: "force-break",
    noSnooze: true,
    reason: "high"
  });
});

test("a high reading is quiet right after a completed break", () => {
  assert.equal(
    getAlertAction({ ...baseAlert, burnRate: 0.75, lastBreakAt: NOW - 60_000 }).type,
    "none"
  );
});

test("a mild reading is also quiet right after a completed break", () => {
  assert.equal(
    getAlertAction({ ...baseAlert, lastBreakAt: NOW - 60_000 }).type,
    "none"
  );
});

test("detected eye fatigue forces break mode even at a low score", () => {
  assert.deepEqual(
    getAlertAction({ ...baseAlert, burnRate: 0.1, fatigueDetected: true }),
    { type: "force-break", noSnooze: true, reason: "high" }
  );
});

test("detected fatigue is also quiet during the break cooldown", () => {
  assert.equal(
    getAlertAction({
      ...baseAlert,
      burnRate: 0.1,
      fatigueDetected: true,
      lastBreakAt: NOW - 1_000
    }).type,
    "none"
  );
});

test("the snooze window is five minutes", () => {
  assert.equal(SNOOZE_MS, 5 * 60 * 1000);
});
