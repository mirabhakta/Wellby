import { useContext, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import Dashboard from "./components/Dashboard.jsx";
import OnboardingFlow from "./components/OnboardingFlow.jsx";
import BreakMode from "./components/BreakMode.jsx";
import MildToast from "./components/MildToast.jsx";
import { ThemeContext } from "./context/ThemeContext.jsx";
import { STORAGE_KEYS } from "./lib/constants.js";
import { useLocalStorage } from "./hooks/useLocalStorage.js";
import { useBrowserFatigueDetection } from "./hooks/useBrowserFatigueDetection.js";
import { clearWellbyStorage } from "./lib/storage.js";
import { durationBucket, getFeedbackUrl, trackEvent } from "./lib/analytics.js";
import { FORCED_BREAK_COOLDOWN_MS, SNOOZE_MS, getAlertAction, getForcedBreakCount, isHighReading, recordForcedBreak } from "./lib/alerts.js";
import { calculateBurnoutScore } from "./lib/burnout.js";
import {
  SELF_REPORT_WINDOW_MS,
  createSession,
  getSessionSeconds,
  isBaselineEligible,
  isSessionIdle,
  summarizeSession
} from "./lib/sessions.js";
import {
  applyBreakCredit,
  average,
  clampMoodScore,
  getBreakMinutes,
  getMoodFatigueContribution,
  getSetupAvailability,
  normalizeHistory
} from "./lib/wellbeing.js";

function getAdaptiveBurnRate(session, baseline) {
  if (!baseline || !baseline.avgTaskSeconds || !baseline.avgSessionSeconds) {
    return 0;
  }
  const currentAvgTask = average(session.completedTasks.map((task) => task.durationSeconds)) || baseline.avgTaskSeconds;
  const paceRatio = baseline.avgTaskSeconds / Math.max(currentAvgTask, 1);
  const durationRatio = session.elapsedSeconds / Math.max(baseline.avgSessionSeconds, 1);

  let score = 0;
  if (paceRatio < 0.7) {
    score = Math.max(score, 0.45 + (0.7 - paceRatio) * 0.6);
  }
  if (durationRatio > 1.4) {
    score = Math.max(score, 0.45 + (durationRatio - 1.4) * 0.35);
  }

  return Math.max(0, Math.min(1, Number(score.toFixed(2))));
}

export default function App() {
  const { theme, setTheme, mode, toggleMode, colors } = useContext(ThemeContext);
  const [profile, setProfile] = useLocalStorage(STORAGE_KEYS.profile, null);
  const [history, setHistory] = useLocalStorage(STORAGE_KEYS.history, []);
  const [sessions, setSessions] = useLocalStorage(STORAGE_KEYS.sessions, []);
  const [fatigueOptIn, setFatigueOptIn] = useLocalStorage(STORAGE_KEYS.fatigueOptIn, false);
  const [breakLogs, setBreakLogs] = useLocalStorage(STORAGE_KEYS.breakLogs, []);
  const [forcedBreaks, setForcedBreaks] = useLocalStorage(STORAGE_KEYS.forcedBreaks, { date: "", count: 0 });
  const [session, setSession] = useState(createSession);
  const [apiBurnRate, setApiBurnRate] = useState(0.18);
  const [selfReportedAt, setSelfReportedAt] = useState(0);
  const [breakOpen, setBreakOpen] = useState(false);
  const [banner, setBanner] = useState("");
  const [snoozeCount, setSnoozeCount] = useState(0);
  const [alertClock, setAlertClock] = useState(0);
  const [snoozedUntil, setSnoozedUntil] = useState(0);
  const [breakContext, setBreakContext] = useState({ noSnooze: false, reason: "manual", beforeBurnRate: 0 });
  const [notificationState, setNotificationState] = useState(null);
  const activeToastIdRef = useRef(null);
  const breakStartedAtRef = useRef(null);
  const lastBreakAtRef = useRef(0);
  const breakCreditRef = useRef(0);
  const wasHighRef = useRef(false);

  const eligibleSessions = useMemo(() => sessions.filter(isBaselineEligible), [sessions]);
  const baseline = useMemo(() => {
    if (eligibleSessions.length < 3) {
      return null;
    }
    const seed = eligibleSessions.slice(0, 3);
    return {
      avgTaskSeconds: average(seed.map((item) => item.avgTaskSeconds || 0)),
      avgSessionSeconds: average(seed.map((item) => item.durationSeconds || 0))
    };
  }, [eligibleSessions]);
  const fatigueStatus = useBrowserFatigueDetection(fatigueOptIn && Boolean(profile) && !breakOpen);

  const adaptiveBurnRate = useMemo(() => getAdaptiveBurnRate(session, baseline), [session, baseline]);
  const selfReportedActive = selfReportedAt > 0 && Date.now() - selfReportedAt < SELF_REPORT_WINDOW_MS;
  const effectiveBurnRate = Math.max(apiBurnRate, adaptiveBurnRate, fatigueStatus.fatigueDetected ? 0.6 : 0);
  const breakMinutes = useMemo(
    () => getBreakMinutes(effectiveBurnRate, fatigueStatus.fatigueDetected),
    [effectiveBurnRate, fatigueStatus.fatigueDetected]
  );

  function dismissToast() {
    if (activeToastIdRef.current) {
      toast.dismiss(activeToastIdRef.current);
      activeToastIdRef.current = null;
    }
  }

  function clearAllNotifications() {
    dismissToast();
    setBanner("");
    setNotificationState(null);
    setSnoozeCount(0);
    setSnoozedUntil(0);
  }

  function triggerFullBreakMode({ noSnooze, reason }) {
    if (breakOpen) {
      return;
    }
    dismissToast();
    const bannerText =
      reason === "high"
        ? "Wellby is stepping in - your burn rate is high. Let's take a proper break."
        : reason === "mild-escalation"
          ? "You've snoozed twice - Wellby thinks it's really time now. Let's recharge!"
          : "";
    setBanner(bannerText);
    setNotificationState(reason === "manual" ? null : "high");
    setBreakContext({ noSnooze, reason, beforeBurnRate: effectiveBurnRate });
    breakStartedAtRef.current = Date.now();
    setBreakOpen(true);
  }

  function handleSnooze() {
    const newCount = snoozeCount + 1;
    const now = Date.now();
    setSnoozeCount(newCount);
    setSnoozedUntil(now + SNOOZE_MS);
    setSession((current) => (current.active ? { ...current, lastActionAt: now } : current));
    dismissToast();
    setNotificationState(null);
    if (newCount >= 2) {
      setBanner("One more check-in and Wellby will ask for a real break.");
    }
  }

  function handleDismiss() {
    const now = Date.now();
    dismissToast();
    setNotificationState(null);
    setSnoozedUntil(now + SNOOZE_MS);
    setSession((current) => (current.active ? { ...current, lastActionAt: now } : current));
  }

  function showMildToast(urgent = false) {
    if (activeToastIdRef.current) {
      return;
    }
    dismissToast();
    setNotificationState("mild");
    const toastId = toast.custom(
      <MildToast
        burnRate={effectiveBurnRate}
        snoozeCount={snoozeCount}
        urgent={urgent}
        onDismiss={handleDismiss}
        onSnooze={handleSnooze}
        onTakeBreak={() => {
          dismissToast();
          triggerFullBreakMode({ noSnooze: false, reason: urgent ? "self-report" : "manual" });
        }}
      />,
      { duration: Infinity }
    );
    activeToastIdRef.current = toastId;
  }

  useEffect(() => {
    if (!profile || breakOpen || !session.active) {
      return undefined;
    }
    const timer = setInterval(() => {
      setSession((current) =>
        current.active ? { ...current, elapsedSeconds: getSessionSeconds(current) } : current
      );
    }, 1000);
    return () => clearInterval(timer);
  }, [profile, breakOpen, session.active]);

  useEffect(() => {
    if (!profile || breakOpen || !session.active) {
      return;
    }

    if (isSessionIdle(session)) {
      endSession({ source: "auto" });
    }
  }, [profile, breakOpen, session.active, session.elapsedSeconds]);

  useEffect(() => {
    if (!profile || breakOpen || !session.active) {
      return;
    }

    const averageTaskSeconds =
      average(session.completedTasks.map((task) => task.durationSeconds)) || baseline?.avgTaskSeconds || 2400;
    const moodFatigue = getMoodFatigueContribution(session.moodScore);
    const burnoutPayload = {
      mental_fatigue_score: Number(
        Math.min(
          10,
          Math.max(
            0,
            moodFatigue +
              Math.min(4, session.elapsedSeconds / 3600) +
              Math.max(0, (averageTaskSeconds - (baseline?.avgTaskSeconds || averageTaskSeconds)) / 600)
          )
        ).toFixed(2)
      ),
      hours_worked: Number((session.elapsedSeconds / 3600).toFixed(2)),
      wfh_setup_available: getSetupAvailability(profile.setup),
      designation: profile.seniority,
      resource_allocation: Number(
        Math.min(10, Math.max(1, 4 + session.completedTasks.length + session.actions / 12)).toFixed(2)
      )
    };

    const { score } = calculateBurnoutScore(burnoutPayload);
    const adjusted = applyBreakCredit(score, breakCreditRef.current);
    breakCreditRef.current = 0;

    setApiBurnRate(adjusted);
    setHistory((current) =>
      normalizeHistory([
        ...current.filter((entry) => entry.sessionId !== session.startedAt),
        { sessionId: session.startedAt, burnRate: Math.max(adjusted, adaptiveBurnRate), timestamp: new Date().toISOString() }
      ])
    );
  }, [
    profile,
    breakOpen,
    Math.floor(session.elapsedSeconds / 30),
    session.completedTasks,
    session.actions,
    session.moodScore,
    baseline,
    setHistory,
    session.startedAt,
    adaptiveBurnRate
  ]);

  useEffect(() => {
    if (!profile || breakOpen) {
      return;
    }

    if (!session.active && !selfReportedActive) {
      return;
    }

    const highNow = isHighReading({
      burnRate: effectiveBurnRate,
      fatigueDetected: fatigueStatus.fatigueDetected
    });
    const action = getAlertAction({
      burnRate: effectiveBurnRate,
      fatigueDetected: fatigueStatus.fatigueDetected,
      selfReported: selfReportedActive,
      notificationState,
      snoozeCount,
      snoozedUntil,
      lastBreakAt: lastBreakAtRef.current,
      previousHigh: wasHighRef.current,
      forcedToday: getForcedBreakCount(forcedBreaks),
      now: Date.now()
    });
    wasHighRef.current = highNow;

    if (action.type === "clear") {
      clearAllNotifications();
      return;
    }

    if (action.type === "capped") {
      setBanner("You've taken three Wellby breaks today. The meter stays on, but no more interruptions.");
      return;
    }

    if (action.type === "force-break") {
      setForcedBreaks((current) => recordForcedBreak(current));
      triggerFullBreakMode({ noSnooze: action.noSnooze, reason: action.reason });
      return;
    }

    if (action.type === "mild") {
      showMildToast(Boolean(action.urgent));
    }
  }, [
    effectiveBurnRate,
    fatigueStatus.fatigueDetected,
    selfReportedActive,
    profile,
    breakOpen,
    session.active,
    notificationState,
    snoozeCount,
    snoozedUntil,
    forcedBreaks,
    alertClock
  ]);

  useEffect(() => {
    const remaining = FORCED_BREAK_COOLDOWN_MS - (Date.now() - lastBreakAtRef.current);
    if (!lastBreakAtRef.current || remaining <= 0) {
      return undefined;
    }

    const timer = setTimeout(() => setAlertClock((current) => current + 1), remaining);
    return () => clearTimeout(timer);
  }, [sessions.length]);

  useEffect(() => {
    if (!snoozedUntil) {
      return undefined;
    }

    const remaining = snoozedUntil - Date.now();
    if (remaining <= 0) {
      return undefined;
    }

    const timer = setTimeout(() => setSnoozedUntil(0), remaining);
    return () => clearTimeout(timer);
  }, [snoozedUntil]);

  useEffect(() => {
    if (!selfReportedAt) {
      return undefined;
    }

    const remaining = SELF_REPORT_WINDOW_MS - (Date.now() - selfReportedAt);
    if (remaining <= 0) {
      setSelfReportedAt(0);
      return undefined;
    }

    const timer = setTimeout(() => {
      setSelfReportedAt(0);
      setAlertClock((current) => current + 1);
    }, remaining);
    return () => clearTimeout(timer);
  }, [selfReportedAt]);

  function startSession(source = "manual") {
    setSession(createSession());
    setSelfReportedAt(0);
    wasHighRef.current = false;
    clearAllNotifications();
    trackEvent("session_started", { source });
  }

  function handleClearData() {
    trackEvent("data_cleared", {});
    clearWellbyStorage();
    window.location.reload();
  }

  function endSession({ source = "manual", selfReport = null } = {}) {
    if (!session.active) {
      return;
    }

    const endedAt = source === "auto" ? session.lastActionAt : Date.now();
    const summary = summarizeSession(session, { endedAt, source, selfReport });

    if (isBaselineEligible(summary)) {
      setSessions((current) => [...current, summary]);
    }

    setSession((current) => ({
      ...current,
      active: false,
      elapsedSeconds: getSessionSeconds(current, endedAt),
      lastActionAt: endedAt
    }));
    clearAllNotifications();

    if (selfReport === "exhausted") {
      setSelfReportedAt(Date.now());
    }

    trackEvent("session_ended", {
      source,
      duration: durationBucket(summary.durationSeconds),
      selfReport: selfReport ?? "none",
      baselineEligible: isBaselineEligible(summary)
    });
  }

  function completeBreak() {
    const breakDurationSeconds = breakStartedAtRef.current
      ? Math.max(0, Math.floor((Date.now() - breakStartedAtRef.current) / 1000))
      : 0;
    breakStartedAtRef.current = null;

    setBreakLogs((current) => [
      ...current,
      {
        timestamp: new Date().toISOString(),
        durationMinutes: Math.max(1, Math.round(breakDurationSeconds / 60))
      }
    ]);
    trackEvent("break_completed", {
      minutes: Math.max(1, Math.round(breakDurationSeconds / 60)),
      reason: breakContext.reason
    });
    lastBreakAtRef.current = Date.now();
    breakCreditRef.current = 0.1;
    setApiBurnRate((current) => Math.max(0, Number((current - 0.1).toFixed(2))));
    setSnoozeCount(0);
    clearAllNotifications();
    setSession((current) =>
      current.active
        ? {
            ...current,
            startedAt: current.startedAt + breakDurationSeconds * 1000,
            lastActionAt: Date.now(),
            activeTask: current.activeTask
              ? {
                  ...current.activeTask,
                  startedAt: current.activeTask.startedAt + breakDurationSeconds * 1000
                }
              : null
          }
        : current
    );
  }

  function handleTaskStart() {
    const taskName = session.taskInput.trim();
    if (!taskName) {
      return;
    }

    const now = Date.now();
    const resuming = !session.active;
    setSession((current) => {
      const base = current.active ? current : createSession(now);
      return {
        ...base,
        actions: base.actions + 1,
        activeTask: { id: now, name: taskName, startedAt: now },
        taskInput: "",
        lastActionAt: now
      };
    });

    if (resuming) {
      trackEvent("session_started", { source: "activity" });
    }
  }

  function handleTaskComplete() {
    setSession((current) => {
      if (!current.activeTask) {
        return current;
      }

      const now = Date.now();
      return {
        ...current,
        active: true,
        lastActionAt: now,
        actions: current.actions + 1,
        activeTask: null,
        completedTasks: [
          ...current.completedTasks,
          {
            ...current.activeTask,
            completedAt: now,
            durationSeconds: Math.max(30, Math.floor((now - current.activeTask.startedAt) / 1000))
          }
        ]
      };
    });
  }

  if (!profile) {
    return (
      <OnboardingFlow
        onComplete={(nextProfile) => {
          setProfile(nextProfile);
          startSession("onboarding");
          trackEvent("onboarding_completed", {
            setup: nextProfile.setup,
            seniority: nextProfile.seniority
          });
        }}
      />
    );
  }

  const feedbackUrl = getFeedbackUrl();

  const statusText = selfReportedActive
    ? "You told us you're running on empty. Treat the next block of work gently, or take the break."
    : effectiveBurnRate < 0.3
      ? "Your pace looks sustainable right now."
      : effectiveBurnRate < 0.6
        ? "Things are starting to stack up. A shorter pause could help."
        : "Your system is asking for a real pause before work gets heavier.";

  return (
    <>
      <Dashboard
        profile={profile}
        session={session}
        burnRate={effectiveBurnRate}
        history={history}
        statusText={statusText}
        breakMinutes={breakMinutes}
        fatigueOptIn={fatigueOptIn}
        fatigueStatus={fatigueStatus}
        selfReported={selfReportedActive}
        onTaskInputChange={(value) => setSession((current) => ({ ...current, taskInput: value }))}
        onTaskStart={handleTaskStart}
        onTaskComplete={handleTaskComplete}
        onStartSession={() => startSession("manual")}
        onEndSession={(selfReport) => endSession({ source: "manual", selfReport })}
        onMoodSelect={(score) => {
          const now = Date.now();
          const resuming = !session.active;
          setSession((current) => {
            const base = current.active ? current : createSession(now);
            return { ...base, moodScore: clampMoodScore(score), lastActionAt: now };
          });
          if (resuming) {
            trackEvent("session_started", { source: "activity" });
          }
        }}
        mode={mode}
        onToggleMode={toggleMode}
        activeTheme={theme}
        onSetTheme={setTheme}
        onToggleFatigue={() => {
          if (!fatigueOptIn) {
            trackEvent("fatigue_optin", {});
          }
          setFatigueOptIn((current) => !current);
        }}
        onStartBreak={() => triggerFullBreakMode({ noSnooze: false, reason: "manual" })}
        onClearData={handleClearData}
        feedbackUrl={feedbackUrl}
        banner={banner}
        notificationState={notificationState}
      />
      {breakOpen ? (
        <BreakMode
          initialGame={profile.favoriteGame}
          noSnooze={breakContext.noSnooze}
          reason={breakContext.reason}
          beforeBurnRate={breakContext.beforeBurnRate}
          afterBurnRate={Math.max(0, Number((effectiveBurnRate - 0.1).toFixed(2)))}
          onClose={() => {
            setBreakOpen(false);
            completeBreak();
          }}
        />
      ) : null}
      <footer
        className="fixed bottom-0 left-0 right-0 px-4 py-3 text-xs font-semibold"
        style={{ background: colors.sidebarBg, color: colors.wordmark }}
      >
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center">
          <span>Wellby is a wellness companion, not a substitute for professional mental health care.</span>
          <a href={feedbackUrl} target="_blank" rel="noreferrer" className="underline">
            Share feedback
          </a>
        </div>
      </footer>
    </>
  );
}
