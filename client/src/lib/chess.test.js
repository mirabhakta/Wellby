import test from "node:test";
import assert from "node:assert/strict";
import { tryMove } from "./chess.js";

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

test("tryMove applies a legal move", () => {
  const result = tryMove(START_FEN, "e2", "e4");

  assert.ok(result, "expected a legal move result");
  assert.equal(result.move.san, "e4");
  assert.match(result.game.fen(), /^rnbqkbnr\/pppppppp\/8\/8\/4P3/);
});

test("tryMove returns null for an illegal move instead of throwing", () => {
  assert.equal(tryMove(START_FEN, "e2", "e5"), null);
});

test("tryMove returns null when the source square is empty", () => {
  assert.equal(tryMove(START_FEN, "e4", "e5"), null);
});

test("tryMove returns null when clicking the same piece twice", () => {
  assert.equal(tryMove(START_FEN, "e2", "e2"), null);
});

test("tryMove does not mutate the caller's game state", () => {
  const result = tryMove(START_FEN, "e2", "e4");

  assert.ok(result);
  assert.equal(START_FEN, "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
});
