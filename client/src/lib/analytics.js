export const DEFAULT_FEEDBACK_URL =
  "https://github.com/mirabhakta/Wellby/issues/new?labels=feedback&title=Wellby%20feedback";

function envValue(name) {
  try {
    return import.meta.env?.[name] ?? "";
  } catch {
    return "";
  }
}

export function getFeedbackUrl() {
  return envValue("VITE_FEEDBACK_URL") || DEFAULT_FEEDBACK_URL;
}

export function durationBucket(seconds) {
  const value = Number(seconds);

  if (!Number.isFinite(value) || value < 0) {
    return "unknown";
  }
  if (value < 5 * 60) {
    return "<5m";
  }
  if (value < 30 * 60) {
    return "5-30m";
  }
  if (value < 60 * 60) {
    return "30-60m";
  }
  return "60m+";
}

export function buildEvent(name, props = {}, now = Date.now()) {
  return { name, props, timestamp: new Date(now).toISOString() };
}

/**
 * Anonymous, opt-in-by-configuration events. With no endpoint the call is a
 * no-op that returns the event, so local builds stay silent. Never send
 * names, free text, moods, or task titles: only coarse buckets.
 */
export function trackEvent(name, props = {}, endpoint = envValue("VITE_ANALYTICS_URL")) {
  const event = buildEvent(name, props);

  if (!endpoint) {
    return event;
  }

  try {
    const payload = JSON.stringify(event);
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      navigator.sendBeacon(endpoint, payload);
    } else {
      fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        keepalive: true
      }).catch(() => {});
    }
  } catch {
    // Analytics must never break the app.
  }

  return event;
}
