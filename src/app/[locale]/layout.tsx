import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Figtree } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import { BRAND_NAME } from "@/config/brand";
import { routing } from "@/i18n/routing";
import { BookingDraftProvider } from "@/components/booking/draft-context";
import "../globals.css";

const display = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--font-bricolage",
});

const body = Figtree({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-figtree",
});

export const metadata: Metadata = {
  title: { default: BRAND_NAME, template: `%s · ${BRAND_NAME}` },
  description: "Book someone to drive you, go with you to a hospital visit, or run an errand.",
};

export const viewport: Viewport = {
  themeColor: "#0e4a43",
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function RootLayout({ children }: LayoutProps<"/[locale]">) {
  const locale = await getLocale();
  return (
    <html lang={locale} className={`${display.variable} ${body.variable}`}>
      <body className="min-h-dvh bg-surface text-ink">
        <NextIntlClientProvider>
          <BookingDraftProvider>{children}</BookingDraftProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
