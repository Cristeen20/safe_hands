import { Suspense } from "react";
import { useTranslations } from "next-intl";
import { getFormatter, getTranslations } from "next-intl/server";
import type { BookingStatus } from "@/domain/booking";
import { Link } from "@/i18n/navigation";
import { requireRole } from "@/lib/authz";
import { formatPhone } from "@/lib/phone";
import { listRequestsByStatus } from "@/server/queries";
import { card, displayHeading } from "@/components/ui/styles";

const TABS = {
  submitted: ["submitted"],
  quoted: ["quoted"],
  confirmed: ["confirmed", "assigned", "in_progress", "completed"],
  closed: ["rejected", "declined", "expired"],
} satisfies Record<string, BookingStatus[]>;
type Tab = keyof typeof TABS;

function isTab(value: unknown): value is Tab {
  return typeof value === "string" && value in TABS;
}

async function Queue({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requireRole("admin");
  const { tab: raw } = await searchParams;
  const tab: Tab = isTab(raw) ? raw : "submitted";
  const [rows, t, ts, tst, format] = await Promise.all([
    listRequestsByStatus(TABS[tab]),
    getTranslations("Admin"),
    getTranslations("ServiceType"),
    getTranslations("Status"),
    getFormatter(),
  ]);

  return (
    <div className="flex flex-col gap-5">
      <nav aria-label={t("requests")} className="flex flex-wrap gap-2">
        {(Object.keys(TABS) as Tab[]).map((key) => (
          <Link
            key={key}
            href={key === "submitted" ? "/admin/requests" : `/admin/requests?tab=${key}`}
            aria-current={key === tab ? "page" : undefined}
            className={`rounded-full border px-4 py-2.5 text-sm font-semibold no-underline ${
              key === tab ? "border-primary bg-primary text-white" : "border-border bg-card text-ink hover:border-primary"
            }`}
          >
            {t(`tabs.${key}`)}
          </Link>
        ))}
      </nav>

      {rows.length === 0 ? (
        <p className="text-muted">{t("emptyTab")}</p>
      ) : (
        <div className={`${card} overflow-x-auto`}>
          <table className="w-full min-w-[820px] text-left text-[15px]">
            <thead className="border-b border-border text-xs tracking-wide text-muted uppercase">
              <tr>
                <th className="px-4 py-3 font-semibold">{t("colWhen")}</th>
                <th className="px-4 py-3 font-semibold">{t("colService")}</th>
                <th className="px-4 py-3 font-semibold">{t("colRoute")}</th>
                <th className="px-4 py-3 font-semibold">{t("colCustomer")}</th>
                <th className="px-4 py-3 font-semibold">{t("colStatus")}</th>
                <th className="px-4 py-3 font-semibold">{t("colSubmitted")}</th>
                <th className="px-4 py-3">
                  <span className="sr-only">{t("view")}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-semibold whitespace-nowrap">
                    {format.dateTime(r.scheduledStart, {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                      hour: "numeric",
                      minute: "2-digit",
                      timeZone: r.timeZone,
                      timeZoneName: "short",
                    })}
                  </td>
                  <td className="px-4 py-3">{ts(r.serviceType)}</td>
                  <td className="px-4 py-3">
                    {r.startAddress} → {r.serviceAddress}
                  </td>
                  <td className="px-4 py-3">
                    {r.customerName || (r.customerPhone ? formatPhone(r.customerPhone) : "—")}
                  </td>
                  <td className="px-4 py-3">{tst(r.status)}</td>
                  <td className="px-4 py-3 text-muted">{format.relativeTime(r.submittedAt, new Date())}</td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/admin/requests/${r.id}`} className="inline-block px-2 py-3 font-bold text-primary">
                      {t("view")}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function RequestsPage({ searchParams }: PageProps<"/[locale]/admin/requests">) {
  const t = useTranslations("Admin");
  const tc = useTranslations("Common");
  return (
    <>
      <h1 className={`${displayHeading} mb-6 text-3xl`}>{t("requests")}</h1>
      <Suspense fallback={<p className="text-muted">{tc("loading")}</p>}>
        <Queue searchParams={searchParams as Promise<{ tab?: string }>} />
      </Suspense>
    </>
  );
}
