import "server-only";

/** Phone-only accounts get a placeholder address; never email it. */
export const PLACEHOLDER_EMAIL_DOMAIN = "@phone.invalid";

export function isDeliverableEmail(email: string | null | undefined): email is string {
  return !!email && !email.endsWith(PLACEHOLDER_EMAIL_DOMAIN);
}

/**
 * Send a plain-text email through Resend. Outside production, without Resend
 * configured, the message is logged to the server console instead.
 */
export async function sendEmail({
  to,
  subject,
  text,
}: {
  to: string;
  subject: string;
  text: string;
}): Promise<void> {
  if (!isDeliverableEmail(to)) return;
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!key || !from) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Email is not configured (RESEND_API_KEY, EMAIL_FROM).");
    }
    console.info(`[email:dev] to ${to}: ${subject}\n${text}`);
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject, text }),
  });
  if (!res.ok) throw new Error(`Resend send failed with ${res.status}`);
}

/** Sign-in code email (D20: the only sign-in option for India). */
export async function sendSignInEmail(email: string, code: string): Promise<void> {
  await sendEmail({
    to: email,
    subject: `Your sign-in code is ${code}`,
    text: `Your sign-in code is ${code}. It expires in 5 minutes.\n\nIf you didn't ask for this, you can ignore this email.`,
  });
}

/** Absolute base URL for links in emails. */
export function appUrl(): string {
  return (process.env.APP_URL ?? process.env.BETTER_AUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");
}
