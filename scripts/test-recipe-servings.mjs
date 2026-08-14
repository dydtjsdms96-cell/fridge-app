/**
 * Recipe detail: servings 2→4 doubles amounts; unit toggle g↔kg.
 * Usage: node scripts/test-recipe-servings.mjs
 */
import { chromium } from "playwright";

const BASE = process.env.APP_URL || "http://localhost:3000";
const EMAIL = process.env.TEST_EMAIL || "test@fridge.app";
const PASSWORD = process.env.TEST_PASSWORD || "test";
const RECIPE_ID = "e452c89c-25aa-4ef0-91a5-42c5d50b4abc"; // 무생채 — 무 200g

function amountFor(page, name) {
  return page.locator(`[data-ingredient="${name}"]`).getAttribute("data-amount");
}

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

    await page.getByTestId("recipe-servings-2").click();
    await page.waitForTimeout(100);
    const at2 = await amountFor(page, "무");
    if (at2 !== "400g") {
      failures.push(`2인분 expected 무 400g, got ${at2}`);
    }

    await page.getByTestId("recipe-servings-4").click();
    await page.waitForTimeout(100);
    const at4Natural = await amountFor(page, "무");
    // natural mode: 800g ≥ 500 → 0.8kg
    if (at4Natural !== "0.8kg") {
      failures.push(`4인분 natural expected 무 0.8kg, got ${at4Natural}`);
    }

    const label = await page.getByTestId("recipe-servings-label").innerText();
    if (!label.includes("4인분")) {
      failures.push(`servings label expected 4인분, got ${label}`);
    }

    await page.getByTestId("recipe-unit-grams").click();
    await page.waitForTimeout(100);
    const at4Grams = await amountFor(page, "무");
    if (at4Grams !== "800g") {
      failures.push(`4인분 grams expected 무 800g, got ${at4Grams}`);
    }

    await page.getByTestId("recipe-unit-natural").click();
    await page.waitForTimeout(100);
    const backNatural = await amountFor(page, "무");
    if (backNatural !== "0.8kg") {
      failures.push(`toggle back natural expected 0.8kg, got ${backNatural}`);
    }

    if (failures.length) {
      console.error("FAIL\n" + failures.join("\n"));
      process.exitCode = 1;
    } else {
      console.log(
        "PASS servings 2→4 (400g→0.8kg) and unit toggle g↔kg (800g↔0.8kg)",
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
