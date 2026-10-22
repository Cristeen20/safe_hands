import { config } from "dotenv";
import postgres from "postgres";
import { expect, type Page } from "@playwright/test";

config({ path: [".env.local", ".env"] });

export const ADMIN_PHONE = "+447400000001";

export const sql = postgres(process.env.DATABASE_URL!, { max: 1 });

/**
 * Put a submitted request straight into the database for an existing user,
 * starting `daysAhead` days from now. Faster than clicking through the form,
 * which booking-request.spec.ts already covers.
 */
export async function createSubmittedBooking(
  customerE164: string,
  { daysAhead = 5, region = "GB", timeZone = "Asia/Kolkata", place = `Clinic ${Date.now()}` } = {},
): Promise<{ id: string; place: string }> {
  const [u] = await sql<{ id: string }[]>`select id from "user" where phone_number = ${customerE164}`;
  if (!u) throw new Error(`No user with phone ${customerE164}; sign them in first`);
  const [r] = await sql<{ id: string }[]>`
    insert into recipient (owner_id, is_self) values (${u.id}, true) returning id`;
  const start = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);
  const [b] = await sql<{ id: string }[]>`
    insert into booking (customer_id, recipient_id, region, service_type, start_address, service_address,
                         scheduled_start, time_zone, estimated_hours, vehicle, status)
    values (${u.id}, ${r.id}, ${region}, 'hospital_visit', '1 High Street', ${place},
            ${start}, ${timeZone}, 2, 'small', 'submitted')
    returning id`;
  await sql`insert into booking_event (booking_id, to_status, actor_id) values (${b.id}, 'submitted', ${u.id})`;
  return { id: b.id, place };
}

export async function bookingStatus(id: string): Promise<string> {
  const [b] = await sql<{ status: string }[]>`select status from booking where id = ${id}`;
  return b.status;
}

/**
 * The latest sign-in code Better Auth stored (as "1234:0"). Phone codes are
 * keyed by the E.164 number, email codes by "sign-in-otp-<email>".
 */
export async function latestCode(identifier: string): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const rows = await sql<{ value: string }[]>`
      select value from verification where identifier = ${identifier}
      order by created_at desc limit 1`;
    if (rows[0]) return rows[0].value.split(":")[0];
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`No sign-in code stored for ${identifier}`);
}

/** A fresh, valid UK mobile number for each test run. */
export function randomUkMobile(): { typed: string; e164: string } {
  const rest = String(Math.floor(100000 + Math.random() * 900000));
  return { typed: `07400 ${rest}`, e164: `+447400${rest}` };
}

/** Sign in through the real UI; the caller must already be on the sign-in page. */
export async function signInOnPage(page: Page, typed: string, e164: string) {
  await page.getByLabel("Mobile number").fill(typed);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page).toHaveURL(/\/sign-in\/verify$/);
  const code = await latestCode(e164);
  await page.getByLabel("Digit 1").fill(code);
}

/** Sign in with an email code; the caller must already be on the sign-in page. */
export async function signInWithEmailOnPage(page: Page, email: string) {
  const emailField = page.getByLabel("Email address");
  if (!(await emailField.isVisible())) {
    await page.getByRole("button", { name: "Continue with email" }).click();
  }
  await emailField.fill(email);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page).toHaveURL(/\/sign-in\/verify$/);
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
  const code = await latestCode(`sign-in-otp-${email.toLowerCase()}`);
  await page.getByLabel("Digit 1").fill(code);
}
