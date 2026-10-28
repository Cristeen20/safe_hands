import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";

export default async function DemoAdminIndex() {
  return redirect({ href: "/demo/admin/requests", locale: await getLocale() });
}
