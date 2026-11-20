export const CARD_COLORS = ["red", "yellow", "green", "blue"];

/**
 * The color a card is played as. Wild cards pick one of CARD_COLORS; a
 * deterministic random source can be injected for tests.
 *
 * This used to read `colors` from theme context while the module kept a
 * CARD_COLORS-style array under the same name, so wild cards resolved to
 * `undefined` and the deck became unplayable.
 */
export function resolvePlayedColor(card, random = Math.random) {
  if (card?.color !== "wild") {
    return card?.color;
  }

  const rawIndex = Math.floor(random() * CARD_COLORS.length);
  const index = Number.isFinite(rawIndex)
    ? Math.min(CARD_COLORS.length - 1, Math.max(0, rawIndex))
    : 0;

  return CARD_COLORS[index];
}
