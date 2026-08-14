/**
 * Recipe steps: {{ing:}} placeholders scale with servings/unit mode.
 * Usage: node scripts/test-step-placeholders.mjs
 */
import { chromium } from "playwright";

const BASE = process.env.APP_URL || "http://localhost:3000";
const EMAIL = process.env.TEST_EMAIL || "test@fridge.app";
const PASSWORD = process.env.TEST_PASSWORD || "test";
const RECIPE_ID = "e452c89c-25aa-4ef0-91a5-42c5d50b4abc"; // 무생채

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const failures = [];

  try {
    await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
    await page.locator('input[type="email"]').fill(EMAIL);
    await page.locator('input[type="password"]').fill(PASSWORD);
    await page.getByRole("button", { name: "로그인" }).click();
    await page.waitForURL((url) => !url.pathname.includes("/login"), {
      timeout: 15000,
    });

    await page.goto(`${BASE}/meal/${RECIPE_ID}`, { waitUntil: "networkidle" });
    await page.getByTestId("recipe-ingredient-list").waitFor({ timeout: 15000 });

    const step1 = () => page.getByTestId("recipe-step-content").first();

    // default 1인분 natural
    let text = await step1().innerText();
    if (!text.includes("무 200g")) {
      failures.push(`1인분 natural expected "무 200g" in step1, got: ${text}`);
    }
    if (text.includes("{{ing:")) {
      failures.push(`placeholders should be resolved, got: ${text}`);
    }
    if (!text.includes("30분") && text.includes("30")) {
      // step4 has 30분 — just ensure we don't break time later
    }

    await page.getByTestId("recipe-servings-4").click();
    await page.waitForTimeout(150);
    text = await step1().innerText();
    if (!text.includes("무 0.8kg")) {
      failures.push(`4인분 natural expected "무 0.8kg" in step1, got: ${text}`);
    }

    await page.getByTestId("recipe-unit-grams").click();
    await page.waitForTimeout(150);
    text = await step1().innerText();
    if (!text.includes("무 800g")) {
      failures.push(`4인분 grams expected "무 800g" in step1, got: ${text}`);
    }

    // time / non-ingredient numbers untouched
    const step4 = page.getByTestId("recipe-step-content").nth(3);
    const s4 = await step4.innerText();
    if (!s4.includes("30분")) {
      failures.push(`step4 should keep "30분", got: ${s4}`);
    }
    if (s4.includes("소금") && !s4.includes("0.3작은술")) {
      // salt was left as literal in step3, check step3
    }
    const step3 = await page.getByTestId("recipe-step-content").nth(2).innerText();
    if (!step3.includes("소금 0.3작은술")) {
      failures.push(`step3 should keep literal salt, got: ${step3}`);
    }

    if (failures.length) {
      console.error("FAIL\n" + failures.join("\n"));
      process.exitCode = 1;
    } else {
      console.log(
        "PASS step placeholders: 1인분 200g → 4인분 0.8kg / grams 800g; times untouched",
      );
    }
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
