import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";

export default async function AdminIndex() {
  return redirect({ href: "/admin/requests", locale: await getLocale() });
}
