import { defineRouting } from "next-intl/routing";
import { LOCALES } from "@/lib/region";

export const routing = defineRouting({
  locales: LOCALES,
  defaultLocale: "en-GB",
});
