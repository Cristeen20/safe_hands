import { Suspense } from "react";
import { useTranslations } from "next-intl";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { QuoteExpiredError, quoteExpiresAt } from "@/domain/booking";
import { toMajor } from "@/domain/money";
import { requireRole } from "@/lib/authz";
import { formatPhone } from "@/lib/phone";
import { REGION_CONFIG } from "@/lib/region";
import { getRequestForAdmin } from "@/server/queries";
import { RequestActions } from "@/components/admin/request-actions";
import { placeLabel, serviceDetails } from "@/components/booking/service-details";
import { BackLink } from "@/components/ui/back-link";
import { card, displayHeading } from "@/components/ui/styles";

async function RequestDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("admin");
  const { id } = await params;
  const [t, ts, tv, td, tst, format, locale] = await Promise.all([
    getTranslations("Admin"),
    getTranslations("ServiceType"),
    getTranslations("Vehicle"),
    getTranslations("Details"),
    getTranslations("Status"),
    getFormatter(),
    getLocale(),
  ]);
  const row = await getRequestForAdmin(id);
  if (!row) return <p>{t("notFound")}</p>;

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
      t("quoteLabel"),
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

      {b.status === "submitted" && (
        <RequestActions
          bookingId={b.id}
          currency={currency}
          currencySymbol={currencySymbol}
          expiryPreview={expiryPreview}
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

export default function RequestDetailPage({ params }: PageProps<"/[locale]/admin/requests/[id]">) {
  const tc = useTranslations("Common");
  return (
    <div className="flex flex-col gap-5">
      <BackLink href="/admin/requests" label={tc("back")} />
      <Suspense fallback={<p className="text-muted">{tc("loading")}</p>}>
        <RequestDetail params={params} />
      </Suspense>
    </div>
  );
}
