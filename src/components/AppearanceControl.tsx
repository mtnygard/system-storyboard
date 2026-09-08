import { useId, useRef, useState } from "react";
import { Sun, Moon, Monitor } from "lucide-react";
import type { Appearance } from "./useAppearance";
const modes = [
  { value: "light", label: "Light mode", name: "Light", Icon: Sun },
  { value: "dark", label: "Dark mode", name: "Dark", Icon: Moon },
  {
    value: "system",
    label: "Follow system appearance",
    name: "System",
    Icon: Monitor,
  },
] as const;
export function AppearanceControl({
  value,
  onChange,
}: {
  value: Appearance;
  onChange: (value: Appearance) => void;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const choices = useRef<HTMLDivElement>(null);
  const current = modes.find((mode) => mode.value === value)!;
  const Icon = current.Icon;
  return (
    <div
      className="appearance-control"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={(e) => {
        if (
          e.relatedTarget instanceof Node &&
          e.currentTarget.contains(e.relatedTarget)
        )
          return;
        if (!e.currentTarget.contains(document.activeElement)) setOpen(false);
      }}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false);
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          setOpen(false);
          trigger.current?.focus();
        }
      }}
    >
      <button
        ref={trigger}
        type="button"
        className="icon-button appearance-trigger"
        aria-label={`Appearance: ${current.name}`}
        title={`Appearance: ${current.name}`}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setTimeout(
              () => choices.current?.querySelector("button")?.focus(),
              0,
            );
          }
        }}
      >
        <Icon size={16} aria-hidden="true" />
      </button>
      {open && (
        <div
          className="appearance-dropdown"
          id={id}
          ref={choices}
          role="group"
          aria-label="Appearance choices"
        >
          {modes
            .filter((mode) => mode.value !== value)
            .map(({ value, label, Icon }) => (
              <button
                key={value}
                type="button"
                className="icon-button"
                aria-label={label}
                title={label}
                onClick={() => {
                  onChange(value);
                  setOpen(false);
                  trigger.current?.focus();
                }}
              >
                <Icon size={16} aria-hidden="true" />
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
