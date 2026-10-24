import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { QuoteExpiredError, quoteExpiresAt } from "@/domain/booking";
import { toMajor } from "@/domain/money";
import { formatPhone } from "@/lib/phone";
import { REGION_CONFIG } from "@/lib/region";
import type { getRequestForAdmin } from "@/server/queries";
import { RequestActions } from "@/components/admin/request-actions";
import { EstimateDetails } from "@/components/booking/price-estimate";
import { placeLabel, serviceDetails } from "@/components/booking/service-details";
import { card, displayHeading } from "@/components/ui/styles";

export type AdminRequest = NonNullable<Awaited<ReturnType<typeof getRequestForAdmin>>>;

/**
 * One request as an admin sees it. With `demo`, the quote and reject forms are
 * shown but switched off (the public demo uses sample data).
 */
export async function RequestDetailView({ row, demo = false }: { row: AdminRequest; demo?: boolean }) {
  const [t, ts, tv, td, tst, format, locale] = await Promise.all([
    getTranslations("Admin"),
    getTranslations("ServiceType"),
    getTranslations("Vehicle"),
    getTranslations("Details"),
    getTranslations("Status"),
    getFormatter(),
    getLocale(),
  ]);

  const b = row.booking;
  const r = row.recipient;
  const currency = REGION_CONFIG[b.region].currency;
  const money = (minor: number, cur: string) => format.number(toMajor(minor), { style: "currency", currency: cur });
  const inBookingZone = (d: Date) =>
    format.dateTime(d, { dateStyle: "medium", timeStyle: "short", timeZone: b.timeZone });

  const fields: [string, React.ReactNode][] = [
    [
      t("colWhen"),
      `${format.dateTime(b.scheduledStart, { dateStyle: "full", timeStyle: "short", timeZone: b.timeZone })} (${b.timeZone})`,
    ],
    [t("colService"), ts(b.serviceType)],
    [t("details"), serviceDetails(b, td, tv).join(" · ") || "—"],
    [t("colRoute"), placeLabel(b)],
    ...(b.startNotes || b.serviceNotes
      ? ([[t("directions"), [b.startNotes, b.serviceNotes].filter(Boolean).join(" · ")]] as [string, string][])
      : []),
    [
      t("customer"),
      [row.customerName, row.customerPhone && formatPhone(row.customerPhone), row.customerEmail]
        .filter((v) => v && !String(v).endsWith("@phone.invalid"))
        .join(" · "),
    ],
    [
      t("recipient"),
      r.isSelf
        ? t("self")
        : `${r.firstName} ${r.lastName}`.trim() + (r.phoneE164 ? ` · ${formatPhone(r.phoneE164)}` : ""),
    ],
    [t("description"), b.description || "—"],
  ];
  if (row.quote) {
    fields.push([
      row.quote.issuedBy ? t("quoteLabel") : t("autoQuote"),
      `${money(row.quote.amountMinor, row.quote.currency)} · ${t("quoteExpires", { date: inBookingZone(row.quote.expiresAt) })}` +
        (row.quote.note ? `\n${row.quote.note}` : ""),
    ]);
  }
  if (b.rejectionReason) fields.push([t("rejectionReason"), b.rejectionReason]);

  let expiryPreview: string | null = null;
  if (b.status === "submitted") {
    try {
      expiryPreview = inBookingZone(quoteExpiresAt(new Date(), b.scheduledStart));
    } catch (err) {
      if (!(err instanceof QuoteExpiredError)) throw err;
    }
  }
  const currencySymbol =
    new Intl.NumberFormat(locale, { style: "currency", currency }).formatToParts(0).find((p) => p.type === "currency")
      ?.value ?? currency;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className={`${displayHeading} text-3xl`}>{t("detailTitle")}</h1>
        <span className="rounded-full bg-accent-soft px-3 py-1 text-sm font-bold">{tst(b.status)}</span>
      </div>
      <dl className={`${card} grid max-w-3xl grid-cols-[minmax(0,10rem)_1fr] gap-x-6 gap-y-3 p-6`}>
        {fields.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-sm font-semibold text-muted">{label}</dt>
            <dd className="whitespace-pre-line">{value}</dd>
          </div>
        ))}
      </dl>

      {b.priceEstimate && (
        <section aria-labelledby="estimate-title" className={`${card} flex max-w-3xl flex-col gap-3 p-6`}>
          <h2 id="estimate-title" className="font-display text-xl font-bold">
            {t("priceTitle")}
          </h2>
          {(b.startPoint || b.servicePoint) && (
            <p className="flex flex-wrap gap-x-4 text-sm">
              {[b.startPoint, b.servicePoint].map(
                (p, i) =>
                  p && (
                    <a
                      key={i}
                      href={`https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-bold text-primary"
                    >
                      {i === 0 ? t("mapPickup") : t("mapDestination")}
                    </a>
                  ),
              )}
            </p>
          )}
          <EstimateDetails estimate={b.priceEstimate} forAdmin />
        </section>
      )}

      {b.status === "submitted" && (
        <RequestActions
          demo={demo}
          bookingId={b.id}
          currency={currency}
          currencySymbol={currencySymbol}
          expiryPreview={expiryPreview}
          suggestedAmount={
            b.priceEstimate?.amountMinor != null ? (b.priceEstimate.amountMinor / 100).toFixed(2) : undefined
          }
        />
      )}

      {row.payments.length > 0 && (
        <section aria-labelledby="payments-title" className={`${card} max-w-3xl p-6`}>
          <h2 id="payments-title" className="mb-3 font-display text-xl font-bold">
            {t("payments")}
          </h2>
          <ul className="flex flex-col gap-2 text-[15px]">
            {row.payments.map((p) => (
              <li key={p.id} className="flex flex-wrap gap-x-3">
                <span className="font-semibold">{money(p.amountMinor, p.currency)}</span>
                <span>{p.provider}</span>
                <span>{p.status}</span>
                <span className="text-muted">{inBookingZone(p.createdAt)}</span>
                {p.late && <strong className="text-red-700">{t("latePayment")}</strong>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="history-title" className={`${card} max-w-3xl p-6`}>
        <h2 id="history-title" className="mb-3 font-display text-xl font-bold">
          {t("historyTitle")}
        </h2>
        <ol className="flex flex-col gap-2 text-[15px]">
          {row.events.map(({ event, actorName, actorRole }) => (
            <li key={event.id} className="flex flex-wrap gap-x-3">
              <span className="text-muted">{inBookingZone(event.at)}</span>
              <span className="font-semibold">{tst(event.toStatus)}</span>
              <span className="text-muted">
                {event.actorId ? `${actorName || "—"} (${actorRole})` : t("system")}
              </span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
