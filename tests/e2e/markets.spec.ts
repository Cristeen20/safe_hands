import { expect, test } from "@playwright/test";
import { signInOnPage, signInWithEmailOnPage } from "./helpers";

const digits = (n: number) => String(Math.floor(Math.random() * 10 ** n)).padStart(n, "0");

test("en-CA: local copy, Quebec notice, and local-format phone sign-in", async ({ page }) => {
  await page.goto("/en-CA/book");
  await expect(page.getByLabel("From", { exact: true })).toHaveAttribute("placeholder", "Street and postal code");
  await expect(page.getByText("We can't take bookings in Quebec.")).toBeVisible();

  const typed = `416 555 ${digits(4)}`;
  await page.goto("/en-CA/sign-in?next=/activity");
  await signInOnPage(page, typed, "+1" + typed.replace(/\D/g, ""));
  await expect(page).toHaveURL(/\/en-CA\/activity$/);
  await expect(page.getByRole("heading", { name: "My bookings" })).toBeVisible();
});

test("en-IN: email-only sign-in, no phone option (D20)", async ({ page }) => {
  await page.goto("/en-IN/book");
  await expect(page.getByLabel("From", { exact: true })).toHaveAttribute("placeholder", "Street, area and PIN code");

  await page.goto("/en-IN/sign-in?next=/activity");
  await expect(page.getByLabel("Mobile number")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Use your phone number instead" })).toHaveCount(0);
  await signInWithEmailOnPage(page, `e2e-${Date.now()}@example.in`);
  await expect(page).toHaveURL(/\/en-IN\/activity$/);
  await expect(page.getByRole("heading", { name: "My bookings" })).toBeVisible();
});

test("never texts an Indian number, even from another country's site (D20)", async ({ page }) => {
  await page.goto("/en-GB/sign-in");
  await page.getByLabel("Mobile number").fill("+91 98765 43210");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByText("We don't send text messages to Indian numbers.")).toBeVisible();
  await expect(page).toHaveURL(/\/en-GB\/sign-in$/);

  // The server refuses too, whatever the browser sends.
  const res = await page.request.post("/api/auth/phone-number/send-otp", {
    data: { phoneNumber: "+919876543210" },
    headers: { Origin: new URL(page.url()).origin },
  });
  expect(res.ok()).toBe(false);
  expect((await res.json()).code).toBe("INVALID_PHONE_NUMBER");
});

test("email sign-in also works on the UK site", async ({ page }) => {
  await page.goto("/en-GB/sign-in?next=/activity");
  await signInWithEmailOnPage(page, `e2e-${Date.now()}@example.co.uk`);
  await expect(page).toHaveURL(/\/en-GB\/activity$/);
});
