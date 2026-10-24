import { AdminChrome } from "@/components/admin/admin-chrome";

// Every admin page and action also checks the role itself (D9); this layout
// only provides the chrome.
export default function AdminLayout({ children }: LayoutProps<"/[locale]/admin">) {
  return <AdminChrome basePath="/admin">{children}</AdminChrome>;
}
