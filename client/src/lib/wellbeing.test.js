import test from "node:test";
import assert from "node:assert/strict";
import { applyBreakCredit, clampMoodScore, getMoodFatigueContribution } from "./wellbeing.js";

test("clampMoodScore keeps values in 1..5", () => {
  assert.equal(clampMoodScore(-10), 1);
  assert.equal(clampMoodScore(1.3), 1);
  assert.equal(clampMoodScore(3), 3);
  assert.equal(clampMoodScore(5.6), 5);
  assert.equal(clampMoodScore(99), 5);
  assert.equal(clampMoodScore("bad"), 3);
});

test("getMoodFatigueContribution is inverse and bounded", () => {
  assert.equal(getMoodFatigueContribution(1), 2.8);
  assert.equal(getMoodFatigueContribution(3), 1.4);
  assert.equal(getMoodFatigueContribution(5), 0);
  assert.equal(getMoodFatigueContribution(42), 0);
});

test("applyBreakCredit lowers a score by the credit", () => {
  assert.equal(applyBreakCredit(0.5, 0.1), 0.4);
  assert.equal(applyBreakCredit(0.3, 0.1), 0.2);
});

test("applyBreakCredit never drops below zero", () => {
  assert.equal(applyBreakCredit(0.05, 0.1), 0);
  assert.equal(applyBreakCredit(0, 0.1), 0);
});

test("applyBreakCredit leaves the score alone without a credit", () => {
  assert.equal(applyBreakCredit(0.62, 0), 0.62);
  assert.equal(applyBreakCredit(0.62), 0.62);
});

test("applyBreakCredit tolerates invalid input", () => {
  assert.equal(applyBreakCredit("oops", 0.1), 0);
  assert.equal(applyBreakCredit(0.5, "oops"), 0.5);
});
