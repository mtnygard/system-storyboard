import type { ReactNode } from "react";
import { ArrowUp, ArrowDown, Trash2 } from "lucide-react";
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function TextField({
  label,
  value,
  onChange,
  multiline = false,
  maxLength = 120,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  maxLength?: number;
}) {
  return (
    <Field label={label}>
      {multiline ? (
        <textarea
          maxLength={maxLength}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          maxLength={maxLength}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </Field>
  );
}
export function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="toggle">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}
export function OrderButtons({
  index,
  count,
  onMove,
  label,
}: {
  index: number;
  count: number;
  onMove: (direction: number) => void;
  label: string;
}) {
  return (
    <span className="order-buttons">
      <button
        type="button"
        className="icon-button"
        aria-label={`Move ${label} up`}
        disabled={index === 0}
        onClick={() => onMove(-1)}
      >
        <ArrowUp size={14} />
      </button>
      <button
        type="button"
        className="icon-button"
        aria-label={`Move ${label} down`}
        disabled={index === count - 1}
        onClick={() => onMove(1)}
      >
        <ArrowDown size={14} />
      </button>
    </span>
  );
}
export function DeleteButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="icon-button danger"
      aria-label={label}
      onClick={onClick}
    >
      <Trash2 size={16} />
    </button>
  );
}
export function Presence({
  value,
  onChange,
}: {
  value: { current: boolean; target: boolean; changed: boolean };
  onChange: (v: Partial<typeof value>) => void;
}) {
  return (
    <div className="presence">
      <Toggle
        label="Current"
        checked={value.current}
        onChange={(current) => onChange({ current })}
      />
      <Toggle
        label="Target"
        checked={value.target}
        onChange={(target) => onChange({ target })}
      />
      <Toggle
        label="Changed"
        checked={value.changed}
        onChange={(changed) => onChange({ changed })}
      />
    </div>
  );
}
