import type { Metadata } from "next";
import { useTranslations } from "next-intl";
import { container } from "@/components/site/container";
import { DemoBanner } from "@/components/site/demo-banner";
import { displayHeading } from "@/components/ui/styles";

export const metadata: Metadata = { robots: { index: false } };

// The helper page as a signed-in helper sees it today: jobs arrive with helper
// assignment, which isn't built yet.
export default function DemoHelperPage() {
  const t = useTranslations("Helper");
  return (
    <>
      <DemoBanner />
      <main className={`${container} flex flex-col gap-4 py-8 md:py-12`}>
        <h1 className={`${displayHeading} text-4xl`}>{t("title")}</h1>
        <p className="text-muted">{t("empty")}</p>
      </main>
    </>
  );
}
