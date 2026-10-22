import { expect, test } from "@playwright/test";
import { signInWithEmailOnPage } from "./helpers";

test("en-IN: pre-booking a package sends a request and adds to its count", async ({ page }) => {
  await page.goto("/en-IN/tours");
  await page.getByRole("button", { name: "Packages" }).click();
  const pkg = page.getByRole("button", { name: /Munnar \+ Vagamon/ });
  await pkg.click();
  await expect(pkg).toHaveAttribute("aria-pressed", "true");
  const before = Number((await pkg.textContent())?.match(/(\d+) pre-booked/)?.[1]);

  await page.getByRole("button", { name: "More people" }).click();
  await page.getByRole("button", { name: "Pre-book for 3 people" }).click();
  await expect(page).toHaveURL(/\/en-IN\/sign-in\?next=/);
  await signInWithEmailOnPage(page, `e2e-tour-${Date.now()}@example.in`);
  await expect(page).toHaveURL(/\/en-IN\/book\/review$/);
  await expect(page.getByText("Guided tour · Package · 3 days · 3 people")).toBeVisible();
  await page.getByRole("button", { name: "Submit request" }).click();
  await expect(page).toHaveURL(/\/en-IN\/activity$/);
  await expect(page.getByText("Munnar + Vagamon").first()).toBeVisible();

  await page.goto("/en-IN/tours");
  await page.getByRole("button", { name: "Packages" }).click();
  await expect(page.getByRole("button", { name: /Munnar \+ Vagamon/ })).toContainText(`${before + 3} pre-booked`);
});

test("custom trips need a place and a date", async ({ page }) => {
  await page.goto("/en-GB/tours");
  // Every tour is in India and is offered on every site (D30).
  await page.getByRole("button", { name: "Packages" }).click();
  await expect(page.getByRole("button", { name: /Munnar \+ Vagamon/ })).toBeVisible();
  await page.getByRole("button", { name: "Custom trip" }).click();
  await page.getByRole("button", { name: "Discuss quote" }).click();
  await expect(page.getByText("Pick a package, stay or place")).toBeVisible();

  await page.getByLabel("Location").fill("Lake District");
  await page.getByLabel("I need a stay").check();
  await page.getByRole("group", { name: "Pick a day" }).getByRole("button").first().click();
  await page.getByRole("group", { name: "Time" }).getByRole("button", { name: "19:00" }).click();
  await page.getByRole("button", { name: "Discuss quote" }).click();
  await expect(page).toHaveURL(/\/en-GB\/sign-in\?next=/);
});
