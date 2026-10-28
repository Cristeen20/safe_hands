import type { Metadata } from "next";
import { AdminChrome } from "@/components/admin/admin-chrome";
import { DemoBanner } from "@/components/site/demo-banner";

export const metadata: Metadata = { robots: { index: false } };

// Public and read-only: sample data only, no role check and no real records.
export default function DemoAdminLayout({ children }: LayoutProps<"/[locale]/demo/admin">) {
  return (
    <AdminChrome basePath="/demo/admin" banner={<DemoBanner />}>
      {children}
    </AdminChrome>
  );
}
