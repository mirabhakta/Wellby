# Wellby 🌿

Work well. Rest well. Be well.

## Live Demo

Try the deployed Wellby app:

[Open the live Wellby app](https://wellby-t1f8.onrender.com/)

Wellby is a friendly AI-powered wellbeing companion for tech industry workers. It tracks how you work, learns your baseline pace, estimates burnout risk, and nudges you toward restorative breaks.

## Stack

- Frontend: React + Tailwind CSS
- Backend: Node.js + Express
- In-repo AI logic:
  - JavaScript burnout/workload heuristic (`POST /api/burnout/predict`)
  - Browser-local fatigue detection (MediaPipe FaceMesh via TensorFlow.js)

## Included features

- Personalized onboarding with name, work setup, seniority, work hours, and favorite break game
- Friendly dashboard with live task tracking and actions-per-minute monitoring
- Adaptive flow engine that builds a baseline over the first 3 sessions
- Burnout risk meter with warm status copy and weekly trend chart
- Three-tier burnout alert system with toast, banner, modal-style escalation, and snoozes
- Opt-in browser-local fatigue detection with a local-only privacy notice
- Break Mode with a 60-second mindful breathing moment
- Built-in Snake, Chess, Tic Tac Toe, and simplified UNO mini-games
- Local persistence for onboarding, burnout history, sessions, and game scores

## Local development

1. Clone this repo.
2. Install dependencies and start the development server:
   - `npm install`
   - `npm run dev`
3. Open [http://localhost:3000](http://localhost:3000).
4. Complete onboarding and start your first Wellby session.

## Deployment

The production app is deployed on Render:

[https://wellby-t1f8.onrender.com/](https://wellby-t1f8.onrender.com/)

Render uses the following commands:

- Build command: `npm ci && npm run build`
- Start command: `NODE_ENV=production node server/index.js`

The Express server serves the Vite production build from `dist/` and listens on the port provided by the hosting platform.

## Scripts

- `npm run dev` starts the Express server on port `3000` and mounts the Vite React frontend in middleware mode.
- `npm run build` builds the React client into `dist/`.
- `npm start` serves the production build from Express.

## API surface

- `GET /api/health`
- `POST /api/burnout/predict`
- `GET /api/fatigue/status`

- `POST /api/burnout/predict` is computed locally in the Node app and does not call an external burnout service.
- `GET /api/fatigue/status` is a compatibility endpoint that reports browser-local fatigue detection guidance. Real fatigue analysis runs only in the user's browser after opt-in.

## NPM packages used

- `chess.js`
- `chessboard.js` package included in `package.json`
- `chart.js`
- `react-hot-toast`
- `framer-motion`

## Notes

- Weekly burnout history, session summaries, break logs, and game scores are stored in `localStorage`.
- Fatigue detection runs locally in the browser when the user opts in; webcam frames never leave the device.
- After each completed break, Wellby applies a `-0.1` reducing factor to the next burnout score, with a floor of `0.0`.
