import test from "node:test";
import assert from "node:assert/strict";
import { clampMoodScore, getMoodFatigueContribution } from "./wellbeing.js";

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
