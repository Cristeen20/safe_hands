import { Suspense } from "react";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/authz";
import { container } from "@/components/site/container";
import { displayHeading } from "@/components/ui/styles";

async function Jobs() {
  await requireRole("helper");
  const t = await getTranslations("Helper");
  // Assigned jobs arrive with helper assignment in the next milestone.
  return <p className="text-muted">{t("empty")}</p>;
}

export default function HelperPage() {
  const t = useTranslations("Helper");
  const tc = useTranslations("Common");
  return (
    <main className={`${container} flex flex-col gap-4 py-8 md:py-12`}>
      <h1 className={`${displayHeading} text-4xl`}>{t("title")}</h1>
      <Suspense fallback={<p className="text-muted">{tc("loading")}</p>}>
        <Jobs />
      </Suspense>
    </main>
  );
}
