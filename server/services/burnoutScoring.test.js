import test from "node:test";
import assert from "node:assert/strict";
import { calculateBurnoutScore } from "./burnoutScoring.js";

test("calculateBurnoutScore returns deterministic bounded score", () => {
  const payload = {
    mental_fatigue_score: 8,
    hours_worked: 9,
    resource_allocation: 7,
    designation: 1,
    wfh_setup_available: 0
  };

  const first = calculateBurnoutScore(payload);
  const second = calculateBurnoutScore(payload);

  assert.equal(first.score, second.score);
  assert.ok(first.score >= 0 && first.score <= 1);
  assert.deepEqual(first.factors, second.factors);
});

test("calculateBurnoutScore clamps invalid values", () => {
  const result = calculateBurnoutScore({
    mental_fatigue_score: 200,
    hours_worked: -3,
    resource_allocation: "oops",
    designation: 99,
    wfh_setup_available: 4
  });

  assert.equal(result.score, 0.5);
  assert.deepEqual(result.factors, {
    mentalFatigue: 1,
    hoursWorked: 0,
    resourceAllocation: 0.5,
    designationRisk: 0,
    wfhSetupRisk: 0
  });
});
