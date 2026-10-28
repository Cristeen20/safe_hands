import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

/** Says the page is the public demo, and links between the admin and helper demos. */
export function DemoBanner() {
  const t = useTranslations("Demo");
  return (
    <div role="note" className="bg-accent px-4 py-3 text-[15px] text-ink">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-5 gap-y-1">
        <strong>{t("banner")}</strong>
        <Link href="/demo/admin/requests" className="inline-block py-2 font-bold text-ink">
          {t("admin")}
        </Link>
        <Link href="/demo/helper" className="inline-block py-2 font-bold text-ink">
          {t("helper")}
        </Link>
      </div>
    </div>
  );
}
