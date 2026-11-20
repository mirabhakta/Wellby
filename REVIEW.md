# Wellby code review

Reviewed at `6ae84e7` (default branch, 2026-10-12).
Reviewer: code review pass with runtime verification, not a read-through.

## Verdict

**Runs, but not as the README describes.** The app installs, builds, and serves
correctly; the burnout meter, the alert escalation, and one break game do not.
Five defects are release-blocking, one of them a hard crash.

## What was verified

| Check | Result |
|---|---|
| `npm ci` | clean, 262 packages |
| `npm test` | 6/6 pass |
| `npm run build` | succeeds (500 kB chunk warnings) |
| `npm run dev` on `:3000` | works, API reachable, matches README |
| `NODE_ENV=production npm start` | serves `dist/`, `/api/health` OK |
| API probes | `/api/*` shapes correct; unknown `/api/*` returns `200 text/html` |
| `chess.js@1.4.0` invalid-move repro | **throws** `Error: Invalid move` |
| `npm audit` | 17 vulns total, **4 in prod deps** (1 critical) |
| README live demo | **503** at review time, deployment not verified |

## Blocking defects

### 1. The burnout meter is permanently stuck at 0%

`client/src/components/BurnoutMeter.jsx:19` vs `client/src/components/Dashboard.jsx:239`

Commit `3cbdb66` renamed the prop from `burnRate` to `score`, but the caller was
never updated:

```jsx
// BurnoutMeter.jsx
export default function WorkloadBalanceMeter({ score = 0, label }) { … }
// Dashboard.jsx
<BurnoutMeter burnRate={burnRate} />
```

`score` is always the default `0`, so the flagship "Burnout risk meter" always
reads *Light week, 0%*. The same commit hardcoded `text-gray-600` /
`bg-gray-200` / `bg-green-400`, which are unreadable on the dark themes, and
dropped the card wrapper the old component had.

This regression survived for months because there is no type checking, lint
step, or render test (see "Repository hygiene").

### 2. Chess crashes the whole app on an illegal click

`client/src/components/games/ChessGame.jsx:126`

```js
const move = next.move({ from: selectedSquare, to: square, promotion: "q" });
if (!move) { setSelectedSquare(square); return; } // unreachable
```

`chess.js` 1.x throws on illegal moves. Verified with the installed
`chess.js@1.4.0`:

```
THREW: Error Invalid move: {"from":"e2","to":"e5","promotion":"q"}
```

There is no `try/catch` and no error boundary, so clicking any two squares that
do not form a legal move unmounts the React tree to a blank screen.

### 3. Users can get trapped in a forced-break loop

`client/src/App.jsx:279-281`, `:404-407`

```js
if (effectiveBurnRate >= 0.6 || fatigueStatus.fatigueDetected) {
  triggerFullBreakMode({ noSnooze: true, reason: "high" });
}
```

Closing the break sets `breakOpen = false`, which re-runs the effect. If the
score is still high (the break credit is wiped out — see #4) or the webcam still
reports fatigue, break mode immediately reopens. The only fatigue toggle is on
the dashboard behind the modal, so the user cannot escape. Realistic path:
webcam latches fatigue → forced break → finish → forced break again.

### 4. The documented post-break `-0.1` is discarded

`client/src/App.jsx:224-226`, `:259`

`breakCredit` is both a dependency of the prediction effect and reset to `0`
inside that effect's own `.then`:

```
break ends → credit 0.1 → fetch → adjusted = raw - 0.1 → credit = 0
           → effect re-runs → fetch → adjusted = raw   // bonus gone in ~1s
```

So the README note ("applies a `-0.1` reducing factor to the next burnout
score, with a floor of `0.0`") is not true beyond a brief flicker. This also
feeds defect #3.

### 5. Snooze and the three-tier escalation never fire

`client/src/App.jsx:130-153`, `:289-291`

`showMildToast()` sets `notificationState = "mild"`. Snoozing dismisses the toast
but leaves that state, and the effect only re-shows on
`notificationState !== "mild"` — so the toast never returns, `snoozeCount` never
reaches 2, and the escalation tier and its banner are unreachable.
`escalateOnNext` state is dead. README's "three-tier burnout alert system with
toast, banner, modal-style escalation, and snoozes" is one toast per mild
episode.

### 6. UNO wild cards break the deck

`client/src/components/games/UnoGame.jsx:4` vs `:57`

A module-level `const colors = ["red","yellow","green","blue"]` is shadowed by
`const { colors } = useContext(ThemeContext)` inside the component. Every
`colors[Math.floor(Math.random() * colors.length)]` then indexes a theme object:

- `colors.length` → `undefined`
- `Math.floor(Math.random() * undefined)` → `NaN`
- `colors[NaN]` → `undefined`

Wild cards get `color: undefined`, so `canPlay` matches almost nothing
afterwards. Both sides draw until the deck empties, then the game deadlocks with
no reshuffle.

## Medium findings

- **Baseline is easy to poison** (`App.jsx:75-84`, `294-308`). A session is only
  recorded when a break is *completed*, so the first three sessions can be three
  one-minute manual breaks. `avgSessionSeconds ≈ 60` makes `durationRatio` huge
  forever, and `avgTaskSeconds ≈ elapsed`. The adaptive engine then alarms
  constantly for the life of the install. Onboarding time is also counted in the
  first session because the timer starts at mount.
- **`workHours` is collected and never used.** `OnboardingFlow.jsx:90-99` writes
  it to `profile`; no code reads it. README lists it as personalization.
- **"AI-powered" is a linear weighted sum** (`server/services/burnoutScoring.js:29-34`).
  Fine as a heuristic, but README and onboarding copy overclaim. Related dead
  compatibility code: `data?.fallback` (`App.jsx:212`) can never be true, and
  the `burnRate` / `burnoutRate` / `workloadBalanceScore` aliases exist for
  services that were removed.
- **SPA fallback swallows API 404s and missing assets** (`server/index.js:49-51`).
  Verified: `GET /api/nope` and `GET /assets/missing.js` both return
  `200 text/html`. That hides typos and makes the browser execute HTML as JS.
  Restrict the fallback to `Accept: text/html` GETs and send a real 404.
- **Production eagerly imports a devDependency** (`server/index.js:5`). `vite` is
  in `devDependencies` but imported at module top level, so the production
  server needs it installed. On Render with `NODE_ENV=production`, `npm ci` can
  omit dev deps → crash on boot. Use a dynamic import inside the `!isProd`
  branch.
- **Theme handling can crash on corrupt storage** (`ThemeContext.jsx:327-329`).
  `themes[theme][mode]` with an unexpected stored string throws. Two key
  namespaces also exist: `wellby.theme` in `constants.js` vs `wellby-theme` in
  the context, so `STORAGE_KEYS.theme` is dead.
- **Snake restarts its interval every render** (`SnakeGame.jsx:32`, `:98`).
  `readStorage` returns a fresh object each render and is in the effect deps;
  the high score is also read twice (`:32`, `:133`). `hitSelf` counts moving
  into the departing tail cell as death.
- **Unbounded localStorage growth.** `sessions` and `breakLogs` are never pruned
  (only `history` is, `wellbeing.js:66`), and every break creates a new
  `sessionId`, so history grows too. Quota failures are silently swallowed by
  `writeStorage`.
- **Dead code / repo hygiene.** `flask_api.py` (renders a template that does not
  exist, prints `OPENAI_API_KEY` to stdout), `requirements.txt` (just `flask`),
  and `.codex/environments/environment.toml` are unrelated to the actual stack
  and absent from the README. `@chrisoakman/chessboardjs` is installed and never
  imported. `getFriendlyStatus` / `getAlertLevel` (`wellbeing.js:33-54`) are
  unused. `burnRate` state (`App.jsx:60`) is written but never read — the UI
  uses `effectiveBurnRate`.
- **No CI, no lint, no types.** No `.github/`, no ESLint, no PropTypes or
  TypeScript. Defect #1 is exactly what a prop contract check catches. Tests
  cover only pure helpers (6 tests), nothing in `App.jsx`, the routes, or the
  games.

## Security

Positives: no XSS surface (React escaping throughout, no
`dangerouslySetInnerHTML`), no committed secrets, input is clamped and
number-guarded server-side, and fatigue frames genuinely stay local — no network
egress exists in `useBrowserFatigueDetection.js`.

Issues:

1. **`flask_api.py:5` — `print(os.environ.get("OPENAI_API_KEY"))`.** Dead code
   today, but the classic "secret in logs" pattern. Delete the file.
2. **Vulnerable dependencies.** `npm audit --omit=dev`: 4 vulns — `proxy-addr`
   **critical** (IP spoofing), `body-parser` high, `path-to-regexp` high, `qs`
   moderate — all transitively through `express@4.22.1`. Total including dev:
   17. `npm audit fix` is available; do it separately and re-run the suite.
3. **No security headers / rate limiting.** No `helmet`, no CSP, no limiter on
   `/api/burnout/predict`. Low risk for a single-user local app, trivial to add.
4. **Malformed JSON logs full stack traces** to stderr (verified with `{"bad"`).
   Add a JSON error handler.
5. **Privacy gaps.** Name, mood, and work patterns are stored indefinitely with
   no "clear my data" path, and the webcam auto-starts on page load if the
   toggle was left on. A reset control and a camera indicator are worth adding.

## README accuracy

| README claim | Reality |
|---|---|
| `npm install` → `npm run dev` → `:3000` | Accurate |
| Build/start on Render | Commands accurate; runtime imports dev-only `vite` |
| "Burnout risk meter" | **Broken** — always 0% |
| "Adaptive flow engine builds a baseline over 3 sessions" | Implemented, but poisonable by break-completed sessions |
| "Three-tier burnout alert system … snoozes" | **Only tier 1 is reachable** |
| "Work hours" personalization | Collected, never used |
| Snake / Chess / Tic Tac Toe / UNO | Chess **crashes**; UNO **deadlocks** after a wild; Tic Tac Toe is solid |
| "−0.1 after each completed break" | **Lost on the next refetch** |
| "AI-powered" | Fixed linear heuristic |
| Live demo link | 503 at review time |
| Weekly trend chart | Works, but one bar per day (last session of the day), not a weekly series |

## Remediation status

This review doubles as the work list for the first PR
(`fix/critical-defects`). Each item lands as its own commit.

- [x] 1. Burnout meter reads the live score (prop contract + theme-aware card)
- [ ] 2. Chess no longer crashes on illegal moves; error boundary added
- [ ] 3. Forced-break cooldown so the modal cannot re-open immediately
- [ ] 4. Post-break credit survives until the next server reading
- [ ] 5. Snooze window and escalation tier actually fire
- [ ] 6. UNO wild cards resolve to a real color

Deferred to follow-up PRs: baseline poisoning, real 404s, dynamic `vite`
import, dependency upgrades, privacy reset, CI/lint/types, dead-code removal
(`flask_api.py`, unused packages and helpers).
