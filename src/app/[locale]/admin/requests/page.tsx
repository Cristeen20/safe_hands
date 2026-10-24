import { Suspense } from "react";
import { useTranslations } from "next-intl";
import { requireRole } from "@/lib/authz";
import { listRequestsByStatus } from "@/server/queries";
import { QUEUE_TABS, queueTab, RequestQueue } from "@/components/admin/request-queue";
import { displayHeading } from "@/components/ui/styles";

async function Queue({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await requireRole("admin");
  const tab = queueTab((await searchParams).tab);
  return <RequestQueue rows={await listRequestsByStatus(QUEUE_TABS[tab])} tab={tab} basePath="/admin" />;
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
