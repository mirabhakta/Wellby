# Wellby 🌿

Work well. Rest well. Be well.

Wellby is a private, local-first wellbeing companion for tech workers. It tracks
how you work, learns your baseline pace, estimates a burnout-risk score, and
nudges you toward restorative breaks.

It is a heuristic, not a medical device and not an AI model. Everything stays in
your browser.

## What it does

- **Onboarding** with name, work setup, seniority, and a favourite break game.
- **Session tracking that is mostly automatic.** A session starts on your first
  action, pauses after 10 minutes without activity, and can be started or ended
  by hand when auto-tracking misses you. Ending a session asks how it felt.
- **A local burnout-risk score** (0–1) built from mood, session length, pace
  against your baseline, resources, seniority, and whether you have a work-from-
  home setup. The same arithmetic runs in the browser and in the optional API.
- **Three alert tiers**: a gentle toast, a snoozeable nudge with a real
  five-minute window, and a full break. Forced breaks only fire on a rising
  reading, at most once per 20 minutes, and at most three times a day.
- **Break mode**: a 60-second breathing moment, then Snake, Chess, Tic Tac Toe,
  or simplified UNO. Completed breaks apply a `-0.1` credit to the next score.
- **Optional browser-local fatigue detection** using MediaPipe FaceMesh. Your
  camera frames never leave the device. The camera stops during breaks.
- **Local persistence** for onboarding, sessions, history, break logs, and game
  scores, plus a **Clear my data** action.

## How the score works

The score is a weighted sum, clamped to 0–1:

| Input | Weight |
|---|---|
| Mood / mental fatigue (lower mood raises fatigue) | 40% |
| Hours worked in the session | 25% |
| Resource allocation (tasks and actions completed) | 20% |
| Seniority (more senior → slightly lower risk in this model) | 10% |
| Work-from-home setup availability | 5% |

It is deliberately simple and explainable. The weights are in
`client/src/lib/burnout.js` if you want to challenge them.

## How sessions and the baseline work

- A session starts when you start a task or check in, or when you press Start.
- Ten minutes without activity pauses it; the next task resumes a new session.
- A session counts toward your baseline only if it lasts at least five minutes
  and contains at least one task or action. Old summaries that do not qualify
  are ignored, so three quick breaks cannot poison the baseline.
- The baseline is the first three eligible sessions and stays fixed, so the
  adaptive pace comparison is stable.

## Privacy

- **No account, no server storage.** Sessions, moods, and settings live in this
  browser's `localStorage`.
- **Camera is opt-in.** Detection runs on-device; frames are never uploaded.
- **Analytics are off by default.** If you set `VITE_ANALYTICS_URL`, Wellby sends
  coarse anonymous events (onboarding finished, session started/ended with a
  duration bucket, break completed, camera opt-in, data cleared). No names, task
  titles, moods, or camera data.
- **Clear my data** in Settings removes every `wellby.*` key.

## Stack

- React 18 + Vite 5 + Tailwind CSS
- Chart.js for the weekly trend
- Framer Motion for small transitions
- MediaPipe FaceMesh via TensorFlow.js for optional local fatigue detection
- Node.js + Express is an **optional** adapter for the API; the shipped app is a
  static build

## Local development

```bash
npm install
npm run dev
```

Open http://localhost:3000. The dev server mounts Vite in middleware mode and
also exposes the optional API.

Other scripts:

```bash
npm run build     # static build in dist/
npm run preview   # serve the static build locally
npm start         # optional Express adapter serving dist/ + the API
npm run lint
npm test          # node:test unit tests
npm run test:ui   # Vitest + Testing Library DOM tests
```

## Deployment

The production target is **Cloudflare Pages** — static, $0, and it never sleeps:

- Build command: `npm run build`
- Output directory: `dist`
- Node version: 24 (see `.nvmrc`)

No server is required. `client/public/_headers` sets `nosniff`, a strict referrer
policy, `X-Frame-Options`, and a camera-only `Permissions-Policy`. A CSP is not
set yet: the face model loads weights from external hosts and that needs its own
tested allow-list.

If you want the API later, deploy the Express adapter (for example on Fly.io) and
set the app to call it. The current client does not call `/api`.

### Optional environment variables

See `.env.example`:

- `VITE_ANALYTICS_URL` — POST endpoint for anonymous events. Blank disables.
- `VITE_FEEDBACK_URL` — feedback link used in the app and footer. Defaults to the
  repository issue form.

## Optional API

- `GET /api/health`
- `POST /api/burnout/predict` — same heuristic as the client
- `GET /api/fatigue/status` — compatibility stub; real analysis is browser-only

## What is deliberately limited

- The risk score is non-clinical and should not be read as a diagnosis.
- Data is per-browser. Clearing site data or using another device starts fresh.
- Fatigue detection is an eye-aspect-ratio heuristic and is sensitive to
  lighting, glasses, and camera angle.
- The mini-games are intentionally simple.
- Accounts, sync, and server-side AI are out of scope for this phase.

## Repo notes

- [`REVIEW.md`](REVIEW.md) records the code review that shaped the current build,
  including the deferred items.
- `shared` logic lives in `client/src/lib/` and is unit tested.
- CI runs lint, both test suites, the production build, and a production-only
  dependency audit on every pull request.

## Feedback

Try it, break it, and tell us what happened:
[open a feedback issue](https://github.com/mirabhakta/Wellby/issues/new?labels=feedback&title=Wellby%20feedback).

Wellby is a wellness companion, not a substitute for professional mental health
care.
