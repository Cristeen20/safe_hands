import { Suspense } from "react";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { connection } from "next/server";
import { demoRequests } from "@/config/demo-requests";
import { RequestDetailView } from "@/components/admin/request-detail";
import { BackLink } from "@/components/ui/back-link";

async function RequestDetail({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  const row = demoRequests(new Date()).find((r) => r.booking.id === id);
  if (!row) return <p>{(await getTranslations("Admin"))("notFound")}</p>;
  return <RequestDetailView row={row} demo />;
}

export default function DemoRequestDetailPage({ params }: PageProps<"/[locale]/demo/admin/requests/[id]">) {
  const tc = useTranslations("Common");
  return (
    <div className="flex flex-col gap-5">
      <BackLink href="/demo/admin/requests" label={tc("back")} />
      <Suspense fallback={<p className="text-muted">{tc("loading")}</p>}>
        <RequestDetail params={params} />
      </Suspense>
    </div>
  );
}
