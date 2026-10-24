"use client";

import { useState, useTransition } from "react";
import type { ReactNode } from "react";
import { useFormatter, useLocale, useTranslations, type DateTimeFormatOptions } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { bookingRequestSchema, bookingValues, type BookingValues } from "@/domain/booking";
import { formatPhone } from "@/lib/phone";
import { regionForLocale, type AppLocale } from "@/lib/region";
import { submitBookingRequest } from "@/server/bookings";
import { BackLink } from "@/components/ui/back-link";
import { BackIcon, LockIcon } from "@/components/ui/icons";
import { card, displayHeading, primaryButton, secondaryButton, textInput } from "@/components/ui/styles";
import { useBookingDraft } from "./draft-context";
import { PriceSummary, payableAmount, useMoney, usePriceEstimate } from "./price-estimate";
import { placeLabel, serviceDetails } from "./service-details";
import { STEP_PATH, stepsFor } from "./steps";
import { usePayBooking } from "./use-pay-booking";
import { WizardStep } from "./wizard";

/** A part of the booking with a link back to the step that set it. */
function Block({ title, href, children }: { title: string; href: string; children: ReactNode }) {
  const tc = useTranslations("Common");
  return (
    <div className="flex flex-col gap-2 border-b border-border py-4 last:border-0">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-[15px] font-bold">{title}</h3>
        <Link href={href} className="flex min-h-11 items-center px-2 text-sm font-bold text-primary">
          {tc("change")}
          <span className="sr-only"> {title}</span>
        </Link>
      </div>
      <dl className="grid grid-cols-[minmax(0,8rem)_1fr] gap-x-4 gap-y-2 text-[15px] sm:grid-cols-[minmax(0,10rem)_1fr]">
        {children}
      </dl>
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-muted">{label}</dt>
      <dd className="min-w-0 font-medium break-words">{children}</dd>
    </>
  );
}

/** `needsEmail`: phone-only customers must give an email for quotes (D11). */
export function ReviewSummary({ needsEmail }: { needsEmail: boolean }) {
  const t = useTranslations("Review");
  const tw = useTranslations("Wizard");
  const { draft, ready } = useBookingDraft();

  if (!ready) return null;

  // Guided tours come from /tours, which isn't part of the step-by-step booking.
  if (draft.serviceType === "tour") {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
        <BackLink href="/tours" label={t("backToTours")} />
        <h1 className={`${displayHeading} text-3xl md:text-4xl`}>{t("title")}</h1>
        <ReviewBody needsEmail={needsEmail} />
      </div>
    );
  }
  return (
    <WizardStep step="review" title={t("title")} subtitle={tw("reviewSub")}>
      <ReviewBody needsEmail={needsEmail} />
    </WizardStep>
  );
}

function ReviewBody({ needsEmail }: { needsEmail: boolean }) {
  const t = useTranslations("Review");
  const tw = useTranslations("Wizard");
  const ts = useTranslations("ServiceType");
  const tv = useTranslations("Vehicle");
  const td = useTranslations("Details");
  const tc = useTranslations("Common");
  const sch = useTranslations("Schedule");
  const tb = useTranslations("Booking");
  const format = useFormatter();
  const locale = useLocale();
  const router = useRouter();
  const { draft, reset } = useBookingDraft();
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [pending, startTransition] = useTransition();
  const estimate = usePriceEstimate(draft);
  const payable = payableAmount(estimate);
  const money = useMoney();
  const pay = usePayBooking();

  // The same parsing the server does, so the summary shows what will be stored.
  const parsed = bookingRequestSchema.safeParse({ ...draft, region: regionForLocale(locale as AppLocale) });
  let values: BookingValues | null = null;
  if (parsed.success) {
    try {
      values = bookingValues(parsed.data);
    } catch {
      // An unknown package or stay: treat it as incomplete.
    }
  }
  const tour = draft.serviceType === "tour";
  const editHref = tour ? "/tours" : STEP_PATH.details;

  if (!values) {
    return (
      <div className="flex flex-col gap-4">
        <p role="alert">{t("incomplete")}</p>
        <Link href={editHref} className={`${primaryButton} sm:w-fit sm:px-8`}>
          {t("backToForm")}
        </Link>
      </div>
    );
  }

  const { scheduledStart, timeZone } = values;
  const inZone = (opts: DateTimeFormatOptions) => format.dateTime(scheduledStart, { ...opts, timeZone });
  const details = serviceDetails(values, td, tv);
  const steps = stepsFor(draft.serviceType);
  const prev = steps[steps.indexOf("review") - 1] as keyof typeof STEP_PATH;

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await submitBookingRequest(locale, draft, needsEmail ? email : undefined);
      if (!result.ok) {
        setError(t(result.error));
        return;
      }
      reset();
      if (!result.payNow) {
        router.replace("/activity");
        return;
      }
      // Priced automatically: pay now. If that can't start, the booking page offers it again.
      const outcome = await pay(result.bookingId);
      if (!outcome.ok) setError(tb(`errors.${outcome.error}`));
      if (!outcome.ok) router.replace(`/activity/${result.bookingId}`);
      else if (!outcome.redirected) router.replace(`/activity/${result.bookingId}?paid=1`);
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="text-base leading-snug text-muted-strong">{payable ? t("introPay") : t("intro")}</p>

      <section aria-label={t("summary")} className={`${card} px-5`}>
        <Block title={tour ? t("service") : tw("step.details")} href={editHref}>
          <Row label={t("service")}>{[ts(values.serviceType), ...details].join(" · ")}</Row>
          {!tour && (
            <Row label={t("forWhom")}>
              {draft.recipient.kind === "self"
                ? sch("forMe")
                : `${draft.recipient.firstName} ${draft.recipient.lastName}`.trim() +
                  ` · ${formatPhone(draft.recipient.phone)}`}
            </Row>
          )}
          <Row label={t("where")}>{placeLabel(values)}</Row>
          {(values.startNotes || values.serviceNotes) && (
            <Row label={t("notes")}>{[values.startNotes, values.serviceNotes].filter(Boolean).join(" · ")}</Row>
          )}
          {values.description && (
            <Row label={t("details")}>
              <span className="block whitespace-pre-line">{values.description}</span>
            </Row>
          )}
        </Block>
        <Block title={tw("step.when")} href={tour ? "/tours" : STEP_PATH.when}>
          <Row label={t("date")}>{inZone({ weekday: "long", day: "numeric", month: "long", year: "numeric" })}</Row>
          <Row label={t("time")}>{inZone({ hour: "numeric", minute: "2-digit", timeZoneName: "short" })}</Row>
        </Block>
      </section>

      {estimate.status !== "none" && (
        <section aria-labelledby="price-title" className={`${card} flex flex-col gap-3 p-5`}>
          <h2 id="price-title" className="text-[17px] font-bold">
            {t("price")}
          </h2>
          <PriceSummary state={estimate} />
        </section>
      )}

      {payable && (
        <section aria-labelledby="method-title" className={`${card} flex items-start gap-3 p-5`}>
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
            <LockIcon size={20} strokeWidth={1.9} />
          </span>
          <div className="flex flex-col gap-0.5">
            <h2 id="method-title" className="text-[17px] font-bold">
              {t("paymentMethod")}
            </h2>
            <p className="text-[15px] text-muted-strong">{t("paymentMethods")}</p>
          </div>
        </section>
      )}

      {needsEmail && (
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          {t("emailLabel")}
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={textInput}
          />
          <span className="font-normal text-muted">{t("emailHint")}</span>
        </label>
      )}
      {error && (
        <p role="alert" className="text-sm font-semibold text-red-700">
          {error}
        </p>
      )}

      <div className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
        {tour ? (
          <span />
        ) : (
          <Link href={STEP_PATH[prev]} className={`${secondaryButton} px-5`}>
            <BackIcon size={18} />
            {tc("back")}
          </Link>
        )}
        <button
          type="button"
          onClick={submit}
          disabled={pending || estimate.status === "loading"}
          className={`${primaryButton} sm:w-fit sm:px-8`}
        >
          {payable && <LockIcon size={18} strokeWidth={2.2} />}
          {pending
            ? t("submitting")
            : payable
              ? t("submitAndPay", { amount: money(payable.minor, payable.currency) })
              : t("submit")}
        </button>
      </div>
      {payable && <p className="text-center text-[13px] text-muted sm:text-right">{t("secureNote")}</p>}
    </div>
  );
}
