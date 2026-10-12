function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function roundScore(value) {
  return Number(value.toFixed(2));
}

export function calculateBurnoutScore(payload = {}) {
  const mentalFatigueScore = clamp(toNumber(payload.mental_fatigue_score), 0, 10);
  const hoursWorked = clamp(toNumber(payload.hours_worked), 0, 16);
  const resourceAllocation = clamp(toNumber(payload.resource_allocation, 5), 0, 10);
  const designation = clamp(toNumber(payload.designation, 2), 0, 5);
  const wfhSetupAvailable = clamp(toNumber(payload.wfh_setup_available), 0, 1);

  const factors = {
    mentalFatigue: mentalFatigueScore / 10,
    hoursWorked: hoursWorked / 10,
    resourceAllocation: resourceAllocation / 10,
    designationRisk: 1 - designation / 5,
    wfhSetupRisk: wfhSetupAvailable ? 0 : 1
  };

  const score =
    factors.mentalFatigue * 0.4 +
    factors.hoursWorked * 0.25 +
    factors.resourceAllocation * 0.2 +
    factors.designationRisk * 0.1 +
    factors.wfhSetupRisk * 0.05;

  return {
    score: roundScore(clamp(score, 0, 1)),
    factors: {
      mentalFatigue: roundScore(factors.mentalFatigue),
      hoursWorked: roundScore(clamp(factors.hoursWorked, 0, 1)),
      resourceAllocation: roundScore(factors.resourceAllocation),
      designationRisk: roundScore(factors.designationRisk),
      wfhSetupRisk: roundScore(factors.wfhSetupRisk)
    }
  };
}
