export const FORCED_BREAK_COOLDOWN_MS = 10 * 60 * 1000;

/**
 * After a completed break, give the user a real recovery window before a high
 * reading can force break mode again. Without this, closing the modal re-ran
 * the alert effect with the same high score and immediately reopened it.
 */
export function isBreakCoolingDown({ now, lastBreakAt }) {
  if (!lastBreakAt) {
    return false;
  }

  return now - lastBreakAt < FORCED_BREAK_COOLDOWN_MS;
}
