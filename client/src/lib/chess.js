import { Chess } from "chess.js";

/**
 * Applies a move without letting chess.js throw on invalid input.
 * Returns { game, move } for a legal move, or null otherwise.
 */
export function tryMove(fen, from, to, promotion = "q") {
  const game = new Chess(fen);

  try {
    const move = game.move({ from, to, promotion });
    return move ? { game, move } : null;
  } catch {
    return null;
  }
}
