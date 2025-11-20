import { test, expect } from "@playwright/test";

test.describe("admin onboarding", () => {
  test("signup page renders self-service form", async ({ page }) => {
    await page.goto("/en/admin/signup");
    await expect(page.getByRole("heading", { name: "Create admin account" })).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
  });

  test("login page links to signup", async ({ page }) => {
    await page.goto("/en/admin/login");
    const signupLink = page.getByRole("link", { name: "Create one" });
    await expect(signupLink).toBeVisible();
    await signupLink.click();
    await expect(page).toHaveURL(/\/admin\/signup$/);
  });

  test("invite accept page warns without token", async ({ page }) => {
    await page.goto("/en/admin/invite/accept");
    await expect(page.getByText("Invite token is missing.")).toBeVisible();
  });
});
