import { act, fireEvent, render, screen } from "@testing-library/react";
import { Toaster } from "react-hot-toast";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import App from "./App.jsx";
import { ThemeProvider } from "./context/ThemeContext.jsx";

const scoring = vi.hoisted(() => ({ score: 0.45 }));

vi.mock("./lib/burnout.js", () => ({
  calculateBurnoutScore: () => ({ score: scoring.score, factors: {} })
}));

vi.mock("./components/TrendChart.jsx", () => ({ default: () => null }));

function renderApp() {
  return render(
    <ThemeProvider>
      <App />
      <Toaster />
    </ThemeProvider>
  );
}

beforeEach(() => {
  localStorage.setItem(
    "wellby.profile",
    JSON.stringify({ name: "Test", setup: "wfh", seniority: 2, favoriteGame: "snake" })
  );
  scoring.score = 0.45;
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

test("shows the session controls and the live meter", () => {
  scoring.score = 0.1;
  renderApp();
  act(() => {});

  expect(screen.getByText(/Auto-tracking this session/)).toBeTruthy();
  expect(screen.getByText("End session")).toBeTruthy();
  expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("10");
});

test("two snoozes survive the idle window and escalate to break mode", () => {
  renderApp();
  act(() => {});

  expect(screen.getByText(/Heads up/)).toBeTruthy();

  fireEvent.click(screen.getByText("5 more minutes"));
  act(() => vi.advanceTimersByTime(5 * 60 * 1000));
  expect(screen.getByText(/Heads up/)).toBeTruthy();

  fireEvent.click(screen.getByText("5 more minutes"));
  act(() => vi.advanceTimersByTime(5 * 60 * 1000));

  expect(screen.getByText(/Mindful Moment/)).toBeTruthy();
});

test("ending a session asks how it felt and pauses tracking", () => {
  scoring.score = 0.1;
  renderApp();
  act(() => {});

  fireEvent.click(screen.getByText("End session"));
  expect(screen.getByText(/How did that session feel/)).toBeTruthy();

  fireEvent.click(screen.getByText("Running on empty"));
  expect(screen.getByText(/Session paused/)).toBeTruthy();
  expect(screen.getByText("Start session")).toBeTruthy();

  act(() => {});
  expect(screen.getByText(/You mentioned you're running on empty/)).toBeTruthy();
});

test("the daily cap shows a banner instead of interrupting", () => {
  localStorage.setItem(
    "wellby.forcedBreaks",
    JSON.stringify({ date: new Date().toDateString(), count: 3 })
  );
  scoring.score = 0.8;

  renderApp();
  act(() => {});

  expect(screen.getByText(/three Wellby breaks today/)).toBeTruthy();
  expect(screen.queryByText(/Mindful Moment/)).toBeNull();
});

test("clearing data removes every key the app owns", () => {
  scoring.score = 0.1;
  renderApp();
  act(() => {});

  fireEvent.click(screen.getByText("Clear my data"));
  fireEvent.click(screen.getByText("Yes, delete everything"));

  expect(localStorage.getItem("wellby.profile")).toBeNull();
  expect(Object.keys(localStorage).filter((key) => key.startsWith("wellby"))).toEqual([]);
});
