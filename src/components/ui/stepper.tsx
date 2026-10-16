"use client";

import { MinusIcon, PlusIcon } from "./icons";

const stepButton =
  "flex size-11 items-center justify-center rounded-full border border-border-strong bg-card text-ink hover:bg-field disabled:cursor-not-allowed disabled:opacity-40";

/** A − value + counter (hours, days, people). */
export function Stepper({
  value,
  min,
  max,
  onChange,
  lessLabel,
  moreLabel,
  display = String(value),
}: {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  lessLabel: string;
  moreLabel: string;
  display?: string;
}) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      <button
        type="button"
        aria-label={lessLabel}
        disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
        className={stepButton}
      >
        <MinusIcon size={16} strokeWidth={2.6} />
      </button>
      <span aria-live="polite" className="min-w-16 text-center font-display text-xl font-bold">
        {display}
      </span>
      <button
        type="button"
        aria-label={moreLabel}
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
        className={stepButton}
      >
        <PlusIcon size={16} strokeWidth={2.6} />
      </button>
    </div>
  );
}
