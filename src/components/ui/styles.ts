// Shared class strings for the canvas's recurring controls. Every interactive
// element keeps a minimum 44px touch target.

export const primaryButton =
  "flex h-14 w-full items-center justify-center gap-2 rounded-button bg-primary px-5 text-[17px] font-bold text-white no-underline transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50";

export const secondaryButton =
  "flex h-14 items-center justify-center gap-2 rounded-button border border-border-strong bg-card px-5 text-base font-semibold text-ink no-underline hover:bg-field";

export const iconButton =
  "flex size-11 shrink-0 items-center justify-center rounded-full border border-border bg-card text-ink hover:bg-field";

export const textInput =
  "h-14 w-full rounded-field border border-border-strong bg-card px-4 text-[17px] font-medium text-ink outline-none placeholder:text-muted focus:border-primary focus:border-[1.5px]";

export const fieldLabel = "flex flex-col gap-1.5 text-sm font-semibold";

export const card = "rounded-card border border-border bg-card";

export const displayHeading = "font-display font-bold tracking-tight";

/** Toggle chip; pair with aria-pressed. */
export function chip(selected: boolean) {
  return selected
    ? "min-h-11 rounded-full border border-primary bg-primary px-4 text-[15px] font-semibold text-white"
    : "min-h-11 rounded-full border border-border bg-card px-4 text-[15px] font-semibold text-ink hover:bg-field";
}
