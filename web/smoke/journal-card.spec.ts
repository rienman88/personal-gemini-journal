import { expect, test } from "@playwright/test";

test("journal card can collapse and expand with a bounded scroll area", async ({ page }) => {
  await page.goto("/smoke/journal-card-harness.html");

  const card = page.locator("#entry-card-entry");
  const toggle = card.getByRole("button", { name: "Collapse journal entry from 9/3/2026" });
  const body = card.locator(".entry-card-body");

  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(body).toBeVisible();

  const scrollMetrics = await body.evaluate((element) => ({
    scrollHeight: element.scrollHeight,
    clientHeight: element.clientHeight,
    overflowY: getComputedStyle(element).overflowY,
  }));
  expect(scrollMetrics.scrollHeight).toBeGreaterThan(scrollMetrics.clientHeight);
  expect(scrollMetrics.overflowY).toBe("auto");

  await toggle.click();
  await expect(card.getByRole("button", { name: "Expand journal entry from 9/3/2026" })).toHaveAttribute("aria-expanded", "false");
  await expect(body).toBeHidden();

  await card.getByRole("button", { name: "Expand journal entry from 9/3/2026" }).click();
  await expect(body).toBeVisible();
});
