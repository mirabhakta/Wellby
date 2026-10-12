import test from "node:test";
import assert from "node:assert/strict";
import {
  createFatigueStatus,
  getFatigueDisabledStatus,
  getFatigueUnsupportedStatus
} from "./fatigue.js";

test("createFatigueStatus preserves required shape", () => {
  const status = createFatigueStatus({ connected: true, confidence: 0.6 });

  assert.equal(status.fatigueDetected, false);
  assert.equal(status.connected, true);
  assert.equal(status.confidence, 0.6);
  assert.equal(status.status, "idle");
});

test("fallback fatigue statuses are safe defaults", () => {
  const disabled = getFatigueDisabledStatus();
  const unsupported = getFatigueUnsupportedStatus();

  assert.equal(disabled.fatigueDetected, false);
  assert.equal(disabled.connected, false);
  assert.equal(disabled.status, "disabled");

  assert.equal(unsupported.fatigueDetected, false);
  assert.equal(unsupported.connected, false);
  assert.equal(unsupported.status, "unsupported");
});
