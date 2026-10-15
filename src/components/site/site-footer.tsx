import { useTranslations } from "next-intl";
import { BRAND_NAME } from "@/config/brand";
import { Link } from "@/i18n/navigation";
import { container } from "./container";

export function SiteFooter() {
  const t = useTranslations("Footer");
  return (
    <footer className="mt-16 border-t border-border bg-card">
      <div
        className={`${container} flex flex-col gap-4 py-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between`}
      >
        <p>
          © {BRAND_NAME} · {t("tagline")}
        </p>
        <nav aria-label={t("label")} className="flex flex-wrap gap-x-5 gap-y-2">
          {(
            [
              ["en-US", "us"],
              ["en-CA", "ca"],
              ["en-GB", "uk"],
              ["en-IN", "in"],
            ] as const
          ).map(([locale, key]) => (
            <Link key={locale} href="/" locale={locale} className="py-2 text-muted">
              {t(key)}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
