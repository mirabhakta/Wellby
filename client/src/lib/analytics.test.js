import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_FEEDBACK_URL, buildEvent, durationBucket, getFeedbackUrl, trackEvent } from "./analytics.js";

const NOW = 1_760_000_000_000;

test("duration buckets cover the launch reporting ranges", () => {
  assert.equal(durationBucket(0), "<5m");
  assert.equal(durationBucket(5 * 60), "5-30m");
  assert.equal(durationBucket(30 * 60), "30-60m");
  assert.equal(durationBucket(60 * 60), "60m+");
  assert.equal(durationBucket("oops"), "unknown");
});

test("buildEvent produces a serialisable anonymous event", () => {
  assert.deepEqual(buildEvent("session_ended", { duration: "5-30m" }, NOW), {
    name: "session_ended",
    props: { duration: "5-30m" },
    timestamp: new Date(NOW).toISOString()
  });
});

test("trackEvent is silent without an endpoint", () => {
  const event = trackEvent("session_started", {}, "");

  assert.equal(event.name, "session_started");
});

test("feedback falls back to the repository issue form", () => {
  assert.equal(getFeedbackUrl(), DEFAULT_FEEDBACK_URL);
  assert.match(DEFAULT_FEEDBACK_URL, /^https:\/\//);
});
