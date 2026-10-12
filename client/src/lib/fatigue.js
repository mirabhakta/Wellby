export function createFatigueStatus(overrides = {}) {
  return {
    fatigueDetected: false,
    connected: false,
    confidence: 0,
    status: "idle",
    ...overrides
  };
}

export function getFatigueDisabledStatus() {
  return createFatigueStatus({
    status: "disabled",
    warning: "Fatigue detection is off. Enable it to start local webcam analysis."
  });
}

export function getFatigueUnsupportedStatus() {
  return createFatigueStatus({
    status: "unsupported",
    warning: "This browser does not support local webcam fatigue detection."
  });
}
