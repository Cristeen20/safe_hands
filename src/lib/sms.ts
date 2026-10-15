import "server-only";
import { canReceiveSms } from "./phone";

/**
 * Send a sign-in code by SMS. Outside production, without Twilio configured,
 * the code is logged to the server console instead.
 */
export async function sendSignInCode(phoneE164: string, code: string): Promise<void> {
  if (!canReceiveSms(phoneE164)) throw new Error("SMS is not sent to this number's country (D20).");
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;

  if (!sid || !token || !from) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("SMS is not configured (TWILIO_* env vars).");
    }
    console.info(`[sms:dev] sign-in code for ${phoneE164}: ${code}`);
    return;
  }

  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      To: phoneE164,
      From: from,
      Body: `Your sign-in code is ${code}. It expires in 5 minutes.`,
    }),
  });
  if (!res.ok) throw new Error(`Twilio send failed with ${res.status}`);
}

