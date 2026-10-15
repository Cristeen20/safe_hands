import { parsePhoneNumberFromString } from "libphonenumber-js/min";
import { REGION_CONFIG, REGIONS, type Region } from "./region";

function inLaunchMarket(country: string | undefined): boolean {
  return !!country && (REGIONS as readonly string[]).includes(country);
}

/**
 * Parse a phone number typed in any common format and return it in E.164
 * (`+447400123456`), or null if it isn't a valid number in a launch market
 * (US, Canada, UK, India). `region` is the default country for numbers typed
 * without a `+` — so "(416) 555-0142" is Canadian on the Canadian site.
 */
export function toE164(input: string, region: Region): string | null {
  const parsed = parsePhoneNumberFromString(input.trim(), region);
  if (!parsed || !parsed.isValid() || !inLaunchMarket(parsed.country)) return null;
  return parsed.number;
}

export function isSupportedPhone(e164: string): boolean {
  const parsed = parsePhoneNumberFromString(e164);
  return !!parsed && parsed.isValid() && inLaunchMarket(parsed.country);
}

/** The launch market a valid number belongs to, or null. */
export function phoneRegion(e164: string): Region | null {
  const country = parsePhoneNumberFromString(e164)?.country;
  return inLaunchMarket(country) ? (country as Region) : null;
}

/** D20: we never text Indian numbers. Check before any SMS, including sign-in codes. */
export function canReceiveSms(e164: string): boolean {
  const region = isSupportedPhone(e164) ? phoneRegion(e164) : null;
  return !!region && REGION_CONFIG[region].smsAllowed;
}

export function formatPhone(e164: string): string {
  return parsePhoneNumberFromString(e164)?.formatInternational() ?? e164;
}
