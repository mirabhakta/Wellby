import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "vite";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

// Renders the real Dashboard through Vite's SSR loader so the meter's prop
// contract is exercised end to end, not just the presentational component.
const baseProps = {
  profile: { name: "Test", setup: "wfh", seniority: 2, favoriteGame: "snake" },
  session: {
    elapsedSeconds: 60,
    actions: 2,
    completedTasks: [],
    taskInput: "",
    activeTask: null,
    moodScore: 3
  },
  history: [],
  statusText: "Sustainable pace",
  breakMinutes: 10,
  fatigueOptIn: false,
  onTaskInputChange() {},
  onTaskStart() {},
  onTaskComplete() {},
  onMoodSelect() {},
  mode: "light",
  onToggleMode() {},
  activeTheme: "warm",
  onSetTheme() {},
  onToggleFatigue() {},
  onStartBreak() {},
  banner: "",
  notificationState: null
};

let vite;
let Dashboard;
let ThemeProvider;
let meterModule;

before(async () => {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key)
  };

  vite = await createServer({
    server: { middlewareMode: true, hmr: false },
    logLevel: "silent"
  });

  ({ default: Dashboard } = await vite.ssrLoadModule("/src/components/Dashboard.jsx"));
  ({ ThemeProvider } = await vite.ssrLoadModule("/src/context/ThemeContext.jsx"));
  meterModule = await vite.ssrLoadModule("/src/components/BurnoutMeter.jsx");
});

after(async () => {
  await vite?.close();
});

function renderDashboard(overrides = {}) {
  return renderToStaticMarkup(
    createElement(
      ThemeProvider,
      null,
      createElement(Dashboard, { ...baseProps, ...overrides })
    )
  );
}

test("dashboard renders the live workload score in the meter", () => {
  const html = renderDashboard({ burnRate: 0.42 });

  assert.match(html, /aria-valuenow="42"/);
  assert.match(html, /aria-label="Work-pattern load: 42%"/);
});

test("workload levels map score thresholds to labels", () => {
  assert.equal(meterModule.getWorkloadLevel(0.2).label, "Light week");
  assert.equal(meterModule.getWorkloadLevel(0.33).label, "Light week");
  assert.equal(meterModule.getWorkloadLevel(0.34).label, "Moderate load");
  assert.equal(meterModule.getWorkloadLevel(0.66).label, "Moderate load");
  assert.equal(meterModule.getWorkloadLevel(0.67).label, "Heavy week");
  assert.equal(meterModule.getWorkloadLevel(1).label, "Heavy week");
});

test("workload levels treat missing or invalid scores as light", () => {
  assert.equal(meterModule.getWorkloadLevel(undefined).label, "Light week");
  assert.equal(meterModule.getWorkloadLevel(Number.NaN).label, "Light week");
});
