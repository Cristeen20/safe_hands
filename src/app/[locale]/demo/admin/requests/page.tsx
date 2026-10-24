import { Suspense } from "react";
import { useTranslations } from "next-intl";
import { connection } from "next/server";
import { demoQueueRows, demoRequests } from "@/config/demo-requests";
import { QUEUE_TABS, queueTab, RequestQueue } from "@/components/admin/request-queue";
import { displayHeading } from "@/components/ui/styles";

async function Queue({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await connection();
  const tab = queueTab((await searchParams).tab);
  const statuses: readonly string[] = QUEUE_TABS[tab];
  const rows = demoQueueRows(demoRequests(new Date())).filter((r) => statuses.includes(r.status));
  return <RequestQueue rows={rows} tab={tab} basePath="/demo/admin" />;
}

export default function DemoRequestsPage({ searchParams }: PageProps<"/[locale]/demo/admin/requests">) {
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
