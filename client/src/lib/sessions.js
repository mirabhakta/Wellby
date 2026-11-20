export const IDLE_TIMEOUT_MS = 10 * 60 * 1000;
export const MIN_BASELINE_SECONDS = 5 * 60;
export const SELF_REPORT_WINDOW_MS = 30 * 60 * 1000;

function average(values) {
  if (!values.length) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function createSession(now = Date.now()) {
  return {
    id: now,
    startedAt: now,
    lastActionAt: now,
    active: true,
    elapsedSeconds: 0,
    taskInput: "",
    activeTask: null,
    completedTasks: [],
    actions: 0,
    moodScore: 3
  };
}

export function isSessionIdle(session, now = Date.now()) {
  return Boolean(session?.active) && now - session.lastActionAt >= IDLE_TIMEOUT_MS;
}

export function getSessionSeconds(session, now = Date.now()) {
  if (!session) {
    return 0;
  }

  if (!session.active) {
    return session.elapsedSeconds;
  }

  return Math.max(0, Math.floor((now - session.startedAt) / 1000));
}

/**
 * A session summary for the baseline. Auto-ended sessions stop counting at
 * the last real action, so ten idle minutes do not inflate the average.
 */
export function summarizeSession(session, { endedAt = Date.now(), source = "auto", selfReport = null } = {}) {
  const durationSeconds = Math.max(0, Math.floor((endedAt - session.startedAt) / 1000));
  const taskDurations = session.completedTasks.map((task) => task.durationSeconds);

  return {
    id: session.id,
    durationSeconds,
    avgTaskSeconds: taskDurations.length ? average(taskDurations) : durationSeconds,
    completedTasks: session.completedTasks.length,
    actions: session.actions,
    endedAt: new Date(endedAt).toISOString(),
    source,
    selfReport
  };
}

/**
 * Short bursts do not teach the adaptive engine anything, and a session with
 * no actions at all is someone who opened the tab and walked away.
 */
export function isBaselineEligible(summary) {
  const duration = Number(summary?.durationSeconds);
  const activity = Number(summary?.completedTasks) || 0;
  const actions = Number(summary?.actions) || 0;

  return Number.isFinite(duration) && duration >= MIN_BASELINE_SECONDS && (activity > 0 || actions > 0);
}
