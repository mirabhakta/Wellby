import { useContext } from "react";
import { ThemeContext } from "../context/ThemeContext.jsx";

export const WORKLOAD_LEVELS = [
  { max: 0.33, label: "Light week", tone: "good" },
  { max: 0.66, label: "Moderate load", tone: "warn" },
  { max: 1.0, label: "Heavy week", tone: "high" }
];

export function getWorkloadLevel(score) {
  const parsed = Number(score);
  const bounded = Number.isFinite(parsed) ? parsed : 0;

  return (
    WORKLOAD_LEVELS.find((level) => bounded <= level.max) ??
    WORKLOAD_LEVELS[WORKLOAD_LEVELS.length - 1]
  );
}

/**
 * Props:
 *   score  — number 0–1 (the dashboard passes its current burn rate here)
 *   label? — override the level label
 */
export default function WorkloadBalanceMeter({ score = 0, label }) {
  const { colors } = useContext(ThemeContext);
  const parsed = Number(score);
  const bounded = Number.isFinite(parsed) ? Math.min(1, Math.max(0, parsed)) : 0;
  const level = getWorkloadLevel(bounded);
  const pct = Math.round(bounded * 100);
  const displayLabel = label ?? level.label;
  const fillColor =
    level.tone === "good" ? colors.burnGood : level.tone === "warn" ? colors.burnWarn : colors.burnHigh;

  return (
    <div
      className="rounded-[28px] p-5 shadow-lg"
      style={{ background: colors.cardBg, border: `1px solid ${colors.cardBorder}` }}
    >
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm font-bold uppercase tracking-[0.18em]" style={{ color: colors.muted }}>
          Work-pattern load
        </p>
        <div
          className="rounded-full border px-3 py-1 text-sm font-bold"
          style={{ background: colors.secondary, color: colors.secondaryText, borderColor: colors.cardBorder }}
        >
          {pct}%
        </div>
      </div>

      <h3 className="font-display text-2xl" style={{ color: colors.secondaryText }}>
        {displayLabel}
      </h3>

      <div className="mt-4 h-3 w-full overflow-hidden rounded-full" style={{ background: colors.secondary }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: fillColor }}
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Work-pattern load: ${pct}%`}
        />
      </div>

      <p className="mt-3 text-xs" style={{ color: colors.muted }}>
        This is a rough, non-clinical indicator of your recent work patterns — not a medical or mental-health
        assessment.
      </p>
    </div>
  );
}
