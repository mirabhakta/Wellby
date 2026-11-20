import test from "node:test";
import assert from "node:assert/strict";
import {
  FORCED_BREAK_COOLDOWN_MS,
  MAX_FORCED_BREAKS_PER_DAY,
  SNOOZE_MS,
  getAlertAction,
  getForcedBreakCount,
  isBreakCoolingDown,
  isHighReading,
  recordForcedBreak
} from "./alerts.js";

const NOW = 1_760_000_000_000;

const base = {
  burnRate: 0.45,
  fatigueDetected: false,
  selfReported: false,
  notificationState: null,
  snoozeCount: 0,
  snoozedUntil: 0,
  lastBreakAt: 0,
  previousHigh: false,
  forcedToday: 0,
  now: NOW
};

test("the cooldown window is twenty minutes", () => {
  assert.equal(FORCED_BREAK_COOLDOWN_MS, 20 * 60 * 1000);
});

test("the snooze window is five minutes", () => {
  assert.equal(SNOOZE_MS, 5 * 60 * 1000);
});

test("a high reading is fatigue or a score at the threshold", () => {
  assert.equal(isHighReading({ burnRate: 0.59 }), false);
  assert.equal(isHighReading({ burnRate: 0.6 }), true);
  assert.equal(isHighReading({ burnRate: 0, fatigueDetected: true }), true);
});

test("no previous break means the cooldown is not active", () => {
  assert.equal(isBreakCoolingDown({ now: NOW, lastBreakAt: 0 }), false);
});

test("the cooldown is active until the boundary and expires exactly there", () => {
  assert.equal(isBreakCoolingDown({ now: NOW, lastBreakAt: NOW - 1_000 }), true);
  assert.equal(
    isBreakCoolingDown({ now: NOW, lastBreakAt: NOW - FORCED_BREAK_COOLDOWN_MS }),
    false
  );
});

test("a sustainable reading clears any open alert", () => {
  assert.equal(getAlertAction({ ...base, burnRate: 0.2 }).type, "clear");
});

test("the mild threshold is inclusive", () => {
  assert.equal(getAlertAction({ ...base, burnRate: 0.3 }).type, "mild");
});

test("a mild reading shows a toast when nothing is open", () => {
  assert.deepEqual(getAlertAction(base), { type: "mild" });
});

test("an open toast is not duplicated", () => {
  assert.equal(getAlertAction({ ...base, notificationState: "mild" }).type, "none");
});

test("a snoozed alert stays quiet during the snooze window and returns after it", () => {
  assert.equal(getAlertAction({ ...base, snoozedUntil: NOW + 1 }).type, "none");
  assert.equal(getAlertAction({ ...base, snoozedUntil: NOW - 1 }).type, "mild");
});

test("two snoozes escalate to a full break", () => {
  assert.deepEqual(getAlertAction({ ...base, snoozeCount: 2 }), {
    type: "force-break",
    noSnooze: false,
    reason: "mild-escalation"
  });
});

test("escalation still respects an active snooze window", () => {
  assert.equal(getAlertAction({ ...base, snoozeCount: 2, snoozedUntil: NOW + 1 }).type, "none");
});

test("a rising high reading forces break mode", () => {
  assert.deepEqual(getAlertAction({ ...base, burnRate: 0.75 }), {
    type: "force-break",
    noSnooze: true,
    reason: "high"
  });
});

test("a high reading that was already high does not force again", () => {
  assert.equal(
    getAlertAction({ ...base, burnRate: 0.75, previousHigh: true }).type,
    "none"
  );
});

test("a high reading is quiet during the cooldown", () => {
  assert.equal(
    getAlertAction({ ...base, burnRate: 0.75, lastBreakAt: NOW - 60_000 }).type,
    "none"
  );
});

test("a mild reading is also quiet right after a break", () => {
  assert.equal(getAlertAction({ ...base, lastBreakAt: NOW - 60_000 }).type, "none");
});

test("detected eye fatigue forces on a rising edge, even at a low score", () => {
  assert.deepEqual(
    getAlertAction({ ...base, burnRate: 0.1, fatigueDetected: true }),
    { type: "force-break", noSnooze: true, reason: "high" }
  );
});

test("the daily cap stops forced interruptions", () => {
  assert.equal(
    getAlertAction({ ...base, burnRate: 0.75, forcedToday: MAX_FORCED_BREAKS_PER_DAY }).type,
    "capped"
  );
  assert.equal(
    getAlertAction({ ...base, snoozeCount: 2, forcedToday: MAX_FORCED_BREAKS_PER_DAY }).type,
    "capped"
  );
});

test("a self report of exhaustion produces an urgent mild nudge", () => {
  assert.deepEqual(getAlertAction({ ...base, burnRate: 0.2, selfReported: true }), {
    type: "mild",
    urgent: true
  });
});

test("a self report respects an active snooze window", () => {
  assert.equal(
    getAlertAction({ ...base, burnRate: 0.2, selfReported: true, snoozedUntil: NOW + 1 }).type,
    "none"
  );
});

test("forced break counts reset on a new local day", () => {
  const state = recordForcedBreak({ date: "", count: 0 }, NOW);
  assert.equal(state.count, 1);
  assert.equal(getForcedBreakCount(state, NOW), 1);

  const nextDay = NOW + 24 * 60 * 60 * 1000;
  assert.equal(getForcedBreakCount(state, nextDay), 0);
  assert.equal(recordForcedBreak(state, nextDay).count, 1);
});

test("recording forced breaks increments the same day", () => {
  let state = { date: "", count: 0 };
  state = recordForcedBreak(state, NOW);
  state = recordForcedBreak(state, NOW + 1_000);

  assert.equal(getForcedBreakCount(state, NOW), 2);
});
