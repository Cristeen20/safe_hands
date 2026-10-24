import { getFormatter, getTranslations } from "next-intl/server";
import type { BookingStatus } from "@/domain/booking";
import { Link } from "@/i18n/navigation";
import { formatPhone } from "@/lib/phone";
import type { listRequestsByStatus } from "@/server/queries";
import { placeLabel } from "@/components/booking/service-details";
import { card } from "@/components/ui/styles";

export const QUEUE_TABS = {
  submitted: ["submitted"],
  quoted: ["quoted"],
  confirmed: ["confirmed", "assigned", "in_progress", "completed"],
  closed: ["rejected", "declined", "expired"],
} satisfies Record<string, BookingStatus[]>;
export type QueueTab = keyof typeof QUEUE_TABS;
export type QueueRow = Awaited<ReturnType<typeof listRequestsByStatus>>[number];

export function queueTab(value: unknown): QueueTab {
  return typeof value === "string" && value in QUEUE_TABS ? (value as QueueTab) : "submitted";
}

/** The admin request queue: status tabs and a table. `basePath` is `/admin` or the demo's path. */
export async function RequestQueue({ rows, tab, basePath }: { rows: QueueRow[]; tab: QueueTab; basePath: string }) {
  const [t, ts, tst, format] = await Promise.all([
    getTranslations("Admin"),
    getTranslations("ServiceType"),
    getTranslations("Status"),
    getFormatter(),
  ]);

  return (
    <div className="flex flex-col gap-5">
      <nav aria-label={t("requests")} className="flex flex-wrap gap-2">
        {(Object.keys(QUEUE_TABS) as QueueTab[]).map((key) => (
          <Link
            key={key}
            href={key === "submitted" ? `${basePath}/requests` : `${basePath}/requests?tab=${key}`}
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
                  <td className="px-4 py-3">{placeLabel(r)}</td>
                  <td className="px-4 py-3">
                    {r.customerName || (r.customerPhone ? formatPhone(r.customerPhone) : "—")}
                  </td>
                  <td className="px-4 py-3">{tst(r.status)}</td>
                  <td className="px-4 py-3 text-muted">{format.relativeTime(r.submittedAt, new Date())}</td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`${basePath}/requests/${r.id}`} className="inline-block px-2 py-3 font-bold text-primary">
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
