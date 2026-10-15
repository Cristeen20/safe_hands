"use client";

import { useState, useTransition } from "react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { formatPhone } from "@/lib/phone";
import { zonedToUtc } from "@/lib/time";
import { submitBookingRequest } from "@/server/bookings";
import { card, primaryButton, textInput } from "@/components/ui/styles";
import { isDraftComplete, useBookingDraft } from "./draft-context";

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

/** `needsEmail`: phone-only customers must give an email for quotes (D11). */
export function ReviewSummary({ needsEmail }: { needsEmail: boolean }) {
  const t = useTranslations("Review");
  const ts = useTranslations("ServiceType");
  const tv = useTranslations("Vehicle");
  const sch = useTranslations("Schedule");
  const format = useFormatter();
  const locale = useLocale();
  const router = useRouter();
  const { draft, ready, reset } = useBookingDraft();
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [pending, startTransition] = useTransition();

  if (!ready) return null;

  if (!isDraftComplete(draft)) {
    return (
      <div className="flex flex-col gap-4">
        <p role="alert">{t("incomplete")}</p>
        <Link href="/book" className={primaryButton}>
          {sch("title")}
        </Link>
      </div>
    );
  }

  const when = format.dateTime(zonedToUtc(draft.date!, draft.time!, draft.timeZone!), {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "numeric",
    minute: "2-digit",
    timeZone: draft.timeZone!,
  });
  const flags = [
    draft.needsMobilitySupport && t("mobility"),
    draft.needsDocuments && t("documents"),
  ].filter(Boolean);

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await submitBookingRequest(locale, draft, needsEmail ? email : undefined);
      if (!result.ok) {
        setError(t(result.error));
        return;
      }
      reset();
      router.replace("/activity");
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="text-base leading-snug text-muted-strong">{t("intro")}</p>
      <dl className={`${card} px-4`}>
        <Row label={t("service")} href="/book">
          {ts(draft.serviceType)} · {tv(draft.vehicle)} · {t("hours", { count: draft.estimatedHours })}
        </Row>
        <Row label={t("where")} href="/book">
          {draft.startAddress} → {draft.serviceAddress}
        </Row>
        <Row label={t("when")} href="/book">
          {when}
        </Row>
        <Row label={t("forWhom")} href="/book">
          {draft.recipient.kind === "self"
            ? sch("forMe")
            : `${draft.recipient.firstName} ${draft.recipient.lastName} · ${formatPhone(draft.recipient.phone)}`}
        </Row>
        {(draft.description || flags.length > 0) && (
          <Row label={t("details")} href="/book">
            {draft.description && <span className="block whitespace-pre-line">{draft.description}</span>}
            {flags.length > 0 && <span className="block text-muted">{flags.join(" · ")}</span>}
          </Row>
        )}
      </dl>
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
      <button type="button" onClick={submit} disabled={pending} className={`${primaryButton} sm:w-fit sm:px-10`}>
        {pending ? t("submitting") : t("submit")}
      </button>
    </div>
  );
}
