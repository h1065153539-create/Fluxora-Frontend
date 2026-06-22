import { expect, test } from "@playwright/test";

test("loads with baseline CSP and referrer policies declared", async ({
  page,
}) => {
  const cspErrors: string[] = [];
  page.on("console", (message) => {
    const text = message.text();
    if (message.type() === "error" && /content security policy/i.test(text)) {
      cspErrors.push(text);
    }
  });

  await page.goto("/", { waitUntil: "domcontentloaded" });

  await expect(page).toHaveTitle(/Fluxora/);
  await expect(page.locator("#root")).toBeAttached();

  const csp = await page
    .locator('meta[http-equiv="Content-Security-Policy"]')
    .getAttribute("content");
  expect(csp).toContain("default-src 'self'");
  expect(csp).toContain("script-src 'self'");
  expect(csp).toContain("https://fonts.googleapis.com");
  expect(csp).toContain("https://fonts.gstatic.com");
  expect(csp).toContain("object-src 'none'");
  expect(csp).toContain("connect-src 'self' https: wss:");
  expect(csp).not.toContain("unsafe-eval");

  await expect(page.locator('meta[name="referrer"]')).toHaveAttribute(
    "content",
    "strict-origin-when-cross-origin",
  );
  expect(cspErrors).toEqual([]);
});
