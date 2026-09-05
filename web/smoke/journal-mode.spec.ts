import { expect, test } from "@playwright/test";

test("journal mode toggle exposes AI and Private Journal choices", async ({ page }) => {
  await page.goto("/smoke/journal-mode-harness.html");

  const toggle = page.getByRole("switch");
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  await expect(page.getByText("AI summaries, reflections, categories, and replies are enabled.")).toBeVisible();

  await toggle.click();

  await expect(toggle).toHaveAttribute("aria-checked", "false");
  await expect(page.getByText("Entries are saved without Gemini processing or AI replies.")).toBeVisible();
  await expect(page.getByText("Private Journal", { exact: true })).toHaveClass(/active/);

  const privateFlow = page.getByTestId("private-entry-flow");
  await privateFlow.locator("textarea").fill("A private entry with test.person@example.com.");
  await privateFlow.getByRole("button", { name: "Save entry" }).click();
  await expect(privateFlow.getByRole("dialog")).toHaveCount(0);
  await expect(privateFlow.getByRole("button", { name: /Saving/ })).toBeDisabled();
});
