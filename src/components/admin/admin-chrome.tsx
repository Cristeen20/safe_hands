import { useTranslations } from "next-intl";
import { BRAND_NAME } from "@/config/brand";
import { Link } from "@/i18n/navigation";

/** The admin portal's header and page frame, shared by `/admin` and its public demo. */
export function AdminChrome({
  basePath,
  banner,
  children,
}: {
  basePath: string;
  banner?: React.ReactNode;
  children: React.ReactNode;
}) {
  const t = useTranslations("Admin");
  return (
    <div className="min-h-dvh bg-surface">
      {banner}
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-6 py-4">
          <span className="font-display text-lg font-bold">
            {BRAND_NAME} · {t("title")}
          </span>
          <nav className="flex gap-4 text-[15px] font-semibold">
            <Link href={`${basePath}/requests`} className="px-1 py-3 text-ink">
              {t("requests")}
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
