// The scoring model now lives in the client so the app can run as a static
// site. The API route stays as a thin adapter for local development.
export { calculateBurnoutScore } from "../../client/src/lib/burnout.js";
