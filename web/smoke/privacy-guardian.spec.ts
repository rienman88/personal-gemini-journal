import { expect, test } from "@playwright/test";

const sensitiveEntry = "Contact test.person@example.com before launch.";
const modalName = "This looks like it contains sensitive info";

test("Privacy Guardian closes immediately for both decisions", async ({ page }) => {
  await page.goto("/smoke/privacy-guardian-harness.html");

  const redactFlow = page.getByTestId("redact-flow");
  await redactFlow.locator("textarea").fill(sensitiveEntry);
  await redactFlow.getByRole("button", { name: "Save entry" }).click();

  const redactModal = redactFlow.getByRole("dialog", { name: modalName });
  await expect(redactModal).toBeVisible();
  await redactModal.getByRole("button", { name: "Redact before sending to Gemini" }).click();
  await expect(redactFlow.getByRole("dialog")).toHaveCount(0);
  await expect(redactFlow.getByRole("button", { name: /Saving/ })).toBeDisabled();

  const sendAnywayFlow = page.getByTestId("send-anyway-flow");
  await sendAnywayFlow.locator("textarea").fill(sensitiveEntry);
  await sendAnywayFlow.getByRole("button", { name: "Save entry" }).click();

  const sendAnywayModal = sendAnywayFlow.getByRole("dialog", { name: modalName });
  await expect(sendAnywayModal).toBeVisible();
  await sendAnywayModal.getByRole("button", { name: "Send as-is anyway" }).click();
  await expect(sendAnywayFlow.getByRole("dialog")).toHaveCount(0);
  await expect(sendAnywayFlow.getByRole("button", { name: /Saving/ })).toBeDisabled();
});
