import test from "node:test";
import assert from "node:assert/strict";
import { CARD_COLORS, resolvePlayedColor } from "./uno.js";

test("normal cards keep their own color", () => {
  assert.equal(resolvePlayedColor({ color: "red", type: "number", value: 7 }), "red");
});

test("wild cards resolve to one of the four card colors", () => {
  for (const random of [0, 0.24, 0.25, 0.5, 0.74, 0.99]) {
    const color = resolvePlayedColor({ color: "wild", type: "wild" }, () => random);

    assert.ok(CARD_COLORS.includes(color), `expected a card color, got ${color}`);
  }
});

test("wild draw four resolves to a card color too", () => {
  const color = resolvePlayedColor({ color: "wild", type: "wild4" }, () => 0.6);

  assert.ok(CARD_COLORS.includes(color));
});

test("a degenerate random value is clamped instead of returning undefined", () => {
  assert.equal(resolvePlayedColor({ color: "wild", type: "wild" }, () => 1), "blue");
  assert.equal(resolvePlayedColor({ color: "wild", type: "wild" }, () => Number.NaN), "red");
});
