"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { servicePath } from "@/config/services";
import { Link } from "@/i18n/navigation";
import { BackLink } from "@/components/ui/back-link";
import { ArrowIcon, BackIcon, CheckIcon } from "@/components/ui/icons";
import { card, displayHeading, primaryButton, secondaryButton } from "@/components/ui/styles";
import { useBookingDraft, withService } from "./draft-context";
import { STEP_PATH, firstIncompleteBefore, stepsFor, type BookStep } from "./steps";

/** Numbered steps with a tick on the ones already done. */
export function BookingProgress({ steps, current }: { steps: BookStep[]; current: BookStep }) {
  const t = useTranslations("Wizard");
  const at = steps.indexOf(current);
  return (
    <ol aria-label={t("progress")} className="flex items-start">
      {steps.map((step, i) => {
        const done = i < at;
        const here = i === at;
        return (
          <li
            key={step}
            aria-current={here ? "step" : undefined}
            className="relative flex flex-1 flex-col items-center gap-1.5 text-center"
          >
            {i > 0 && (
              <span
                aria-hidden="true"
                className={`absolute top-[17px] right-[calc(50%+24px)] left-[calc(-50%+24px)] h-0.5 ${i <= at ? "bg-primary" : "bg-border-strong"}`}
              />
            )}
            <span
              className={`relative z-1 flex size-9 items-center justify-center rounded-full text-[15px] font-bold ${
                done
                  ? "bg-primary text-white"
                  : here
                    ? "bg-primary text-white ring-4 ring-primary-soft"
                    : "border-[1.5px] border-border-strong bg-card text-muted"
              }`}
            >
              {done ? <CheckIcon size={18} strokeWidth={2.8} /> : i + 1}
            </span>
            <span
              className={`text-[13px] leading-tight ${here ? "font-bold text-ink" : "text-muted sr-only sm:not-sr-only"}`}
            >
              {t(`step.${step}`)}
              {done && <span className="sr-only"> ({t("done")})</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * One booking step: back link, progress, heading, the step's fields, then
 * Back / Next. If an earlier step is unfinished it says so instead.
 */
export function WizardStep({
  step,
  title,
  subtitle,
  next,
  error,
  children,
}: {
  step: Exclude<BookStep, "payment">;
  title: string;
  subtitle: string;
  /** The Next button; omitted on review, which has its own. */
  next?: { label: string; onClick: () => void };
  error?: string | null;
  children: ReactNode;
}) {
  const t = useTranslations("Wizard");
  const ts = useTranslations("ServiceType");
  const { draft, ready, update } = useBookingDraft();

  // The tours page shares the draft; these steps are for the other services.
  useEffect(() => {
    if (ready && draft.serviceType === "tour" && step !== "review") update(withService(draft, "hospital_visit"));
  }, [ready, draft, step, update]);

  if (!ready || (draft.serviceType === "tour" && step !== "review")) return <div className="h-96" aria-hidden="true" />;

  const service = draft.serviceType === "tour" ? "hospital_visit" : draft.serviceType;
  const steps = stepsFor(service);
  const prev = steps[steps.indexOf(step) - 1] as keyof typeof STEP_PATH | undefined;
  const missing = firstIncompleteBefore(draft, step);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      {prev ? (
        <BackLink href={STEP_PATH[prev]} label={t("back")} />
      ) : (
        <BackLink href={servicePath(service)} label={t("backTo", { service: ts(service) })} />
      )}
      <BookingProgress steps={steps} current={step} />
      <div className="flex flex-col gap-1.5">
        <h1 className={`${displayHeading} text-3xl md:text-4xl`}>{title}</h1>
        <p className="text-[17px] text-muted-strong">{subtitle}</p>
      </div>

      {missing ? (
        <div className={`${card} flex flex-col gap-4 p-6`}>
          <p role="alert" className="text-[17px]">
            {t(`missing.${missing}`)}
          </p>
          <Link href={STEP_PATH[missing]} className={`${primaryButton} sm:w-fit sm:px-8`}>
            {t(`goTo.${missing}`)}
          </Link>
        </div>
      ) : (
        <>
          {children}
          {error && (
            <p role="alert" className="text-[15px] font-semibold text-red-700">
              {error}
            </p>
          )}
          {next && (
            <div className="flex items-center justify-between gap-3 border-t border-border pt-5">
              {prev ? (
                <Link href={STEP_PATH[prev]} className={`${secondaryButton} px-5`}>
                  <BackIcon size={18} />
                  {t("back")}
                </Link>
              ) : (
                <span />
              )}
              <button type="button" onClick={next.onClick} className={`${primaryButton} min-w-0 flex-1 px-5 sm:w-auto sm:flex-none sm:px-8`}>
                {next.label}
                <ArrowIcon size={20} strokeWidth={2.2} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
