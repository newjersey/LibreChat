import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const BASE_URL = "http://localhost:3080";

// Define all the URLs for want to scan
const TEST_CASES = [
  {
    name: "homepage",
    url: `${BASE_URL}/c/new`,
  },
  {
    name: "guides and faq",
    url: `${BASE_URL}/nj/guide`,
  },
];

for (const { name, url } of TEST_CASES) {
  test.describe.parallel(`Homepage accessibility - ${name}`, () => {
    // Primary axe-core scan for this component.
    test("has no detectable a11y violations", async ({ page }) => {
      await page.goto(url);
      await page.waitForLoadState("networkidle");

      // .include(".usa-link") ensures the scan is scoped to the Link itself.
      const accessibilityScanResults = await new AxeBuilder({ page })
        .include("#root")
        .analyze();

      expect(accessibilityScanResults.violations).toEqual([]);
    });
  });
}