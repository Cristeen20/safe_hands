"use client";

import { useState, useTransition } from "react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { bookingRequestSchema, bookingValues, type BookingValues } from "@/domain/booking";
import { formatPhone } from "@/lib/phone";
import { regionForLocale, type AppLocale } from "@/lib/region";
import { submitBookingRequest } from "@/server/bookings";
import { BackLink } from "@/components/ui/back-link";
import { card, primaryButton, textInput } from "@/components/ui/styles";
import { useBookingDraft } from "./draft-context";
import { PriceSummary, isBlocked, payableAmount, useMoney, usePriceEstimate } from "./price-estimate";
import { placeLabel, serviceDetails } from "./service-details";
import { usePayBooking } from "./use-pay-booking";

function Row({ label, href, children }: { label: string; href: string; children: React.ReactNode }) {
  const tc = useTranslations("Common");
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border py-3.5 last:border-0">
      <div className="flex min-w-0 flex-col gap-0.5">
        <dt className="text-xs font-semibold tracking-wide text-muted uppercase">{label}</dt>
        <dd className="text-[15px] font-medium">{children}</dd>
      </div>
      <Link href={href} className="shrink-0 px-2 py-3 text-sm font-bold text-primary">
        {tc("edit")}
        <span className="sr-only"> {label}</span>
      </Link>
    </div>
  );
}

/** Back to whichever form the draft came from. */
export function ReviewBackLink() {
  const t = useTranslations("Review");
  const { draft } = useBookingDraft();
  return draft.serviceType === "tour" ? (
    <BackLink href="/tours" label={t("backToTours")} />
  ) : (
    <BackLink href="/book" label={t("backToForm")} />
  );
}

/** `needsEmail`: phone-only customers must give an email for quotes (D11). */
export function ReviewSummary({ needsEmail }: { needsEmail: boolean }) {
  const t = useTranslations("Review");
  const ts = useTranslations("ServiceType");
  const tv = useTranslations("Vehicle");
  const td = useTranslations("Details");
  const sch = useTranslations("Schedule");
  const format = useFormatter();
  const locale = useLocale();
  const router = useRouter();
  const { draft, ready, reset } = useBookingDraft();
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [pending, startTransition] = useTransition();
  const estimate = usePriceEstimate(draft);
  const payable = payableAmount(estimate);
  const money = useMoney();
  const pay = usePayBooking();
  const tb = useTranslations("Booking");

  if (!ready) return null;

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
  const editHref = draft.serviceType === "tour" ? "/tours" : "/book";

  if (!values) {
    return (
      <div className="flex flex-col gap-4">
        <p role="alert">{t("incomplete")}</p>
        <Link href={editHref} className={primaryButton}>
          {t("backToForm")}
        </Link>
      </div>
    );
  }

  const when = format.dateTime(values.scheduledStart, {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "numeric",
    minute: "2-digit",
    timeZone: values.timeZone,
  });
  const details = serviceDetails(values, td, tv);

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
      if (!outcome.ok || !outcome.redirected) router.replace(`/activity/${result.bookingId}`);
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="text-base leading-snug text-muted-strong">{payable ? t("introPay") : t("intro")}</p>
      <dl className={`${card} px-4`}>
        <Row label={t("service")} href={editHref}>
          {[ts(values.serviceType), ...details].join(" · ")}
        </Row>
        <Row label={t("where")} href={editHref}>
          {placeLabel(values)}
        </Row>
        <Row label={t("when")} href={editHref}>
          {when}
        </Row>
        {values.serviceType !== "tour" && (
          <Row label={t("forWhom")} href={editHref}>
            {draft.recipient.kind === "self"
              ? sch("forMe")
              : `${draft.recipient.firstName} ${draft.recipient.lastName} · ${formatPhone(draft.recipient.phone)}`}
          </Row>
        )}
        {(values.startNotes || values.serviceNotes) && (
          <Row label={t("notes")} href={editHref}>
            {[values.startNotes, values.serviceNotes].filter(Boolean).join(" · ")}
          </Row>
        )}
        {values.description && (
          <Row label={t("details")} href={editHref}>
            <span className="block whitespace-pre-line">{values.description}</span>
          </Row>
        )}
      </dl>
      {estimate.status !== "none" && (
        <section aria-labelledby="price-title" className={`${card} flex flex-col gap-3 p-4`}>
          <h2 id="price-title" className="font-display text-lg font-bold">
            {t("price")}
          </h2>
          <PriceSummary state={estimate} />
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
      <button
        type="button"
        onClick={submit}
        disabled={pending || isBlocked(estimate) || estimate.status === "loading"}
        className={`${primaryButton} sm:w-fit sm:px-10`}
      >
        {pending
          ? t("submitting")
          : payable
            ? t("submitAndPay", { amount: money(payable.minor, payable.currency) })
            : t("submit")}
      </button>
    </div>
  );
}
