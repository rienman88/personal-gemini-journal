import { expect, test } from "@playwright/test";

test("integrity badge distinguishes total, pending redaction, and visible entries", async ({ page }) => {
  await page.goto("/smoke/integrity-harness.html");

  await page.getByRole("button", { name: "Verify journal integrity" }).click();

  await expect(page.getByText("CHAIN INTACT", { exact: true })).toBeVisible();
  await expect(
    page.getByText(
      "Total of 9 entries verified on server database, 8 pending redaction, 1 visible entry",
      { exact: true }
    )
  ).toBeVisible();
});
