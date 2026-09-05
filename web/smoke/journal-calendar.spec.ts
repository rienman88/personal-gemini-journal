import { expect, test } from "@playwright/test";

test("journal calendar marks entry days and navigates to the first entry", async ({ page }) => {
  await page.goto("/smoke/journal-calendar-harness.html");

  const markedDay = page.getByRole("button", { name: /2 journal entries/ });
  await expect(markedDay).toBeVisible();
  await expect(markedDay).toHaveAttribute("aria-pressed", "false");

  await markedDay.click();

  await expect(markedDay).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#entry-first-entry")).toBeInViewport();
  await expect(page.locator("#entry-first-entry .entry-card-body")).toBeVisible();
  await expect(page.locator("#entry-first-entry").getByRole("button", { name: /Collapse journal entry/ })).toHaveAttribute("aria-expanded", "true");

  await page.setViewportSize({ width: 375, height: 800 });
  await page.reload();
  await expect(page.getByRole("button", { name: /2 journal entries/ })).toBeVisible();
  const widths = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(widths.scrollWidth).toBeLessThanOrEqual(widths.clientWidth);
});
