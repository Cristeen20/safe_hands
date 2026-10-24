import { Suspense } from "react";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/authz";
import { getRequestForAdmin } from "@/server/queries";
import { RequestDetailView } from "@/components/admin/request-detail";
import { BackLink } from "@/components/ui/back-link";

async function RequestDetail({ params }: { params: Promise<{ id: string }> }) {
  await requireRole("admin");
  const row = await getRequestForAdmin((await params).id);
  if (!row) return <p>{(await getTranslations("Admin"))("notFound")}</p>;
  return <RequestDetailView row={row} />;
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
