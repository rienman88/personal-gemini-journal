import { expect, test } from "@playwright/test";

test("journal mode toggle exposes AI and Private Journal choices", async ({ page }) => {
  await page.goto("/smoke/journal-mode-harness.html");

  const toggle = page.getByRole("switch");
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  await expect(page.getByText("AI summaries, reflections, categories, and replies are enabled.")).toBeVisible();

  await toggle.click();

  await expect(toggle).toHaveAttribute("aria-checked", "false");
  await expect(page.getByText("Entries are saved without Gemini processing. You can still add private notes.")).toBeVisible();
  await expect(page.getByText("Private Journal", { exact: true })).toHaveClass(/active/);

  const privateFlow = page.getByTestId("private-entry-flow");
  await expect(privateFlow.locator("textarea")).toHaveAttribute("maxlength", "4000");
  await privateFlow.locator("textarea").fill("A private entry with test.person@example.com.");
  await privateFlow.getByRole("button", { name: "Save entry" }).click();
  await expect(privateFlow.getByRole("dialog")).toHaveCount(0);
  await expect(privateFlow.getByRole("button", { name: /Saving/ })).toBeDisabled();

  const privateNoteFlow = page.getByTestId("private-note-flow");
  const privateNote = privateNoteFlow.getByRole("textbox", { name: "Add a private note to this entry" });
  await expect(privateNote).toHaveAttribute("maxlength", "1000");
  await privateNote.fill("A private continuation note.");
  await privateNoteFlow.getByRole("button", { name: "Add private note" }).click();
  await expect(privateNoteFlow.getByRole("button", { name: "..." })).toBeDisabled();
});
