import { expect, test } from "@playwright/test";

test("individual deletion modal closes after the server confirms removal", async ({ page }) => {
  await page.goto("/smoke/delete-entry-harness.html");

  const modal = page.getByRole("dialog", { name: "Remove this journal entry?" });
  await expect(modal).toBeVisible();
  await modal.getByRole("button", { name: "Remove Entry" }).click();

  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByTestId("deleted-status")).toHaveText("Entry removed");
});
