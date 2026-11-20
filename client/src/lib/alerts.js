export const MILD_THRESHOLD = 0.3;
export const HIGH_THRESHOLD = 0.6;
export const FORCED_BREAK_COOLDOWN_MS = 10 * 60 * 1000;
export const SNOOZE_MS = 5 * 60 * 1000;

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

/**
 * Single decision point for the three alert tiers.
 *
 * Mirrors the old effect's rules while making the snooze window real: a
 * snooze suppresses nudges for SNOOZE_MS, and the second snooze schedules the
 * escalation instead of silently dropping it (which is what happened when the
 * toast state was left at "mild").
 *
 * Returns one of:
 *   { type: "clear" }
 *   { type: "none" }
 *   { type: "mild" }
 *   { type: "force-break", noSnooze, reason }
 */
export function getAlertAction({
  burnRate = 0,
  fatigueDetected = false,
  notificationState = null,
  snoozeCount = 0,
  snoozedUntil = 0,
  lastBreakAt = 0,
  now = Date.now()
} = {}) {
  if (burnRate < MILD_THRESHOLD && !fatigueDetected) {
    return { type: "clear" };
  }

  if (isBreakCoolingDown({ now, lastBreakAt })) {
    return { type: "none" };
  }

  if (fatigueDetected || burnRate >= HIGH_THRESHOLD) {
    return { type: "force-break", noSnooze: true, reason: "high" };
  }

  if (now < snoozedUntil) {
    return { type: "none" };
  }

  if (snoozeCount >= 2) {
    return { type: "force-break", noSnooze: false, reason: "mild-escalation" };
  }

  if (notificationState === "mild") {
    return { type: "none" };
  }

  return { type: "mild" };
}
