import * as rootParams from "next/root-params";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import base from "../../messages/en.json";
import { routing } from "./routing";

// `en.json` holds every string; the per-locale files override only the words
// that differ between British and American English.
const overrides = {
  "en-US": () => import("../../messages/en-US.json"),
  "en-CA": () => import("../../messages/en-CA.json"),
  "en-GB": () => import("../../messages/en-GB.json"),
  "en-IN": () => import("../../messages/en-IN.json"),
};

type Messages = Record<string, Record<string, unknown>>;

function merge(a: Messages, b: Messages): Messages {
  const out: Messages = { ...a };
  for (const [ns, values] of Object.entries(b)) out[ns] = { ...a[ns], ...values };
  return out;
}

export default getRequestConfig(async ({ locale }) => {
  if (!locale) {
    const param = await rootParams.locale();
    if (!hasLocale(routing.locales, param)) notFound();
    locale = param;
  }
  const loc = locale as keyof typeof overrides;
  const local = (await overrides[loc]()).default as Messages;
  return { locale, messages: merge(base as Messages, local) };
});
