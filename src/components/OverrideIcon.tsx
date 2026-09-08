import { Link2, RotateCcw } from "lucide-react";
import type { Interaction, State } from "../domain/model";
import type { OverrideKey } from "../domain/interaction-overrides";
export function OverrideIcon({
  interaction,
  field,
  state,
  onReset,
  displayValue,
}: {
  interaction: Interaction;
  field: OverrideKey;
  state: State;
  onReset: () => void;
  displayValue?: string;
}) {
  if (state !== "target" || !interaction.current || !interaction.target)
    return null;
  const overridden = Object.hasOwn(interaction.targetOverrides || {}, field);
  const value = displayValue ?? String(interaction[field] ?? "");
  const label = overridden
    ? `Reset ${field} to current: ${value || "empty"}`
    : `${field} uses current value: ${value || "empty"}`;
  return (
    <span className="override-control">
      <button
        type="button"
        className={`icon-button override-icon ${overridden ? "is-overridden" : ""}`}
        aria-label={label}
        onClick={overridden ? onReset : undefined}
        aria-disabled={!overridden}
      >
        {overridden ? <RotateCcw size={13} /> : <Link2 size={13} />}
      </button>
      <span role="tooltip" className="override-tooltip">
        {label}
      </span>
    </span>
  );
}
