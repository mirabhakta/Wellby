import test from "node:test";
import assert from "node:assert/strict";
import {
  IDLE_TIMEOUT_MS,
  MIN_BASELINE_SECONDS,
  createSession,
  getSessionSeconds,
  isBaselineEligible,
  isSessionIdle,
  summarizeSession
} from "./sessions.js";

const NOW = 1_760_000_000_000;

test("a new session starts active and owned by the current moment", () => {
  const session = createSession(NOW);

  assert.equal(session.active, true);
  assert.equal(session.startedAt, NOW);
  assert.equal(session.lastActionAt, NOW);
  assert.equal(session.elapsedSeconds, 0);
});

test("a session is idle only after the timeout", () => {
  const session = createSession(NOW);

  assert.equal(isSessionIdle(session, NOW + IDLE_TIMEOUT_MS - 1), false);
  assert.equal(isSessionIdle(session, NOW + IDLE_TIMEOUT_MS), true);
});

test("a paused session never becomes idle again", () => {
  const session = { ...createSession(NOW), active: false };

  assert.equal(isSessionIdle(session, NOW + IDLE_TIMEOUT_MS * 4), false);
});

test("elapsed seconds come from the clock while active and freeze when paused", () => {
  const session = createSession(NOW);

  assert.equal(getSessionSeconds(session, NOW + 90_000), 90);
  assert.equal(getSessionSeconds({ ...session, active: false, elapsedSeconds: 42 }, NOW + 90_000), 42);
});

test("an auto-ended session stops counting at the last action", () => {
  const session = { ...createSession(NOW), lastActionAt: NOW + 20 * 60 * 1000 };
  const summary = summarizeSession(session, { endedAt: session.lastActionAt, source: "auto" });

  assert.equal(summary.durationSeconds, 20 * 60);
  assert.equal(summary.source, "auto");
});

test("a summary keeps tasks, actions, and the self report", () => {
  const session = {
    ...createSession(NOW),
    completedTasks: [{ durationSeconds: 300 }, { durationSeconds: 900 }],
    actions: 4
  };
  const summary = summarizeSession(session, {
    endedAt: NOW + 15 * 60 * 1000,
    source: "manual",
    selfReport: "exhausted"
  });

  assert.equal(summary.durationSeconds, 900);
  assert.equal(summary.avgTaskSeconds, 600);
  assert.equal(summary.completedTasks, 2);
  assert.equal(summary.actions, 4);
  assert.equal(summary.selfReport, "exhausted");
});

test("short sessions are excluded from the baseline", () => {
  assert.equal(
    isBaselineEligible({ durationSeconds: MIN_BASELINE_SECONDS - 1, completedTasks: 1, actions: 2 }),
    false
  );
});

test("idle-only sessions are excluded even when they are long", () => {
  assert.equal(isBaselineEligible({ durationSeconds: 30 * 60, completedTasks: 0, actions: 0 }), false);
});

test("a long session with activity is eligible, including old summaries", () => {
  assert.equal(isBaselineEligible({ durationSeconds: 6 * 60, completedTasks: 1 }), true);
  assert.equal(isBaselineEligible({ durationSeconds: 6 * 60, actions: 1 }), true);
});
