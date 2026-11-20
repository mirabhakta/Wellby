export const MILD_THRESHOLD = 0.3;
export const HIGH_THRESHOLD = 0.6;
export const FORCED_BREAK_COOLDOWN_MS = 20 * 60 * 1000;
export const MAX_FORCED_BREAKS_PER_DAY = 3;
export const SNOOZE_MS = 5 * 60 * 1000;

export function isHighReading({ burnRate = 0, fatigueDetected = false } = {}) {
  return Boolean(fatigueDetected) || burnRate >= HIGH_THRESHOLD;
}

/**
 * After a completed break, give the user a real recovery window before a high
 * reading can interrupt again.
 */
export function isBreakCoolingDown({ now, lastBreakAt }) {
  if (!lastBreakAt) {
    return false;
  }

  return now - lastBreakAt < FORCED_BREAK_COOLDOWN_MS;
}

function dayKey(now) {
  return new Date(now).toDateString();
}

export function getForcedBreakCount(state, now = Date.now()) {
  if (!state || state.date !== dayKey(now)) {
    return 0;
  }

  const count = Number(state.count);
  return Number.isFinite(count) && count > 0 ? count : 0;
}

export function recordForcedBreak(state, now = Date.now()) {
  return { date: dayKey(now), count: getForcedBreakCount(state, now) + 1 };
}

/**
 * Single decision point for the alert tiers.
 *
 * Forced breaks happen only on a rising edge (the reading was not high on the
 * previous evaluation), at most once per cooldown, and at most
 * MAX_FORCED_BREAKS_PER_DAY times. Manual breaks are never counted here.
 *
 * Returns one of:
 *   { type: "clear" }
 *   { type: "none" }
 *   { type: "mild", urgent? }
 *   { type: "capped" }
 *   { type: "force-break", noSnooze, reason }
 */
export function getAlertAction({
  burnRate = 0,
  fatigueDetected = false,
  selfReported = false,
  notificationState = null,
  snoozeCount = 0,
  snoozedUntil = 0,
  lastBreakAt = 0,
  previousHigh = false,
  forcedToday = 0,
  now = Date.now()
} = {}) {
  const high = isHighReading({ burnRate, fatigueDetected });

  if (!high && !selfReported && burnRate < MILD_THRESHOLD) {
    return { type: "clear" };
  }

  if (isBreakCoolingDown({ now, lastBreakAt })) {
    return { type: "none" };
  }

  if (high) {
    if (previousHigh) {
      return { type: "none" };
    }

    if (forcedToday >= MAX_FORCED_BREAKS_PER_DAY) {
      return { type: "capped" };
    }

    return { type: "force-break", reason: "high" };
  }

  if (now < snoozedUntil) {
    return { type: "none" };
  }

  if (snoozeCount >= 2) {
    if (forcedToday >= MAX_FORCED_BREAKS_PER_DAY) {
      return { type: "capped" };
    }

    return { type: "force-break", reason: "mild-escalation" };
  }

  if (selfReported && notificationState !== "mild") {
    return { type: "mild", urgent: true };
  }

  if (notificationState === "mild") {
    return { type: "none" };
  }

  return { type: "mild" };
}
