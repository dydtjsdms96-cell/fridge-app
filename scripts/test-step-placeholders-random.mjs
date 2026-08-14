/**
 * 5 recipes: step text scales with servings ({{ing:}} resolved).
 * Usage: node scripts/test-step-placeholders-random.mjs
 */
import { chromium } from "playwright";

const BASE = process.env.APP_URL || "http://localhost:3000";
const EMAIL = process.env.TEST_EMAIL || "test@fridge.app";
const PASSWORD = process.env.TEST_PASSWORD || "test";

const TARGETS = [
  {
    title: "무생채",
    id: "e452c89c-25aa-4ef0-91a5-42c5d50b4abc",
    at1: "무 200g",
    at4: "무 0.8kg",
  },
  { title: "가지볶음", id: "43a9c179-1838-45e4-839b-7abdc46aeefa" },
  { title: "감자조림", id: "fff004db-ae02-434d-a7ec-3f428d23d8b9" },
  { title: "계란볶음밥", id: "d310539d-68e5-49df-90fe-326564319c1a" },
  { title: "카레라이스", id: "359b272e-82e4-473c-a5bd-92b37f221520" },
];

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const failures = [];
  const results = [];

  try {
    await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
    await page.locator('input[type="email"]').fill(EMAIL);
    await page.locator('input[type="password"]').fill(PASSWORD);
    await page.getByRole("button", { name: "로그인" }).click();
    await page.waitForURL((url) => !url.pathname.includes("/login"), {
      timeout: 15000,
    });

    for (const recipe of TARGETS) {
      await page.goto(`${BASE}/meal/${recipe.id}`, { waitUntil: "networkidle" });
      await page
        .getByTestId("recipe-ingredient-list")
        .waitFor({ timeout: 15000 });
      const steps = page.getByTestId("recipe-step-content");
      await steps.first().waitFor({ timeout: 10000 });

      await page.getByTestId("recipe-servings-1").click();
      await page.waitForTimeout(150);
      let n = await steps.count();
      const at1 = (
        await Promise.all(
          Array.from({ length: n }, (_, i) => steps.nth(i).innerText()),
        )
      ).join("\n");

      await page.getByTestId("recipe-servings-4").click();
      await page.waitForTimeout(150);
      n = await steps.count();
      const at4 = (
        await Promise.all(
          Array.from({ length: n }, (_, i) => steps.nth(i).innerText()),
        )
      ).join("\n");

      if (at1.includes("{{ing:") || at4.includes("{{ing:")) {
        failures.push(`${recipe.title}: unresolved {{ing:}}`);
      }
      if (recipe.at1 && !at1.includes(recipe.at1)) {
        failures.push(`${recipe.title}: 1인분 missing ${recipe.at1}\n${at1}`);
      }
      if (recipe.at4 && !at4.includes(recipe.at4)) {
        failures.push(`${recipe.title}: 4인분 missing ${recipe.at4}\n${at4}`);
      }
      if (at1 === at4) {
        failures.push(`${recipe.title}: steps unchanged 1→4`);
      }

      results.push({
        title: recipe.title,
        changed: at1 !== at4,
        preview1: at1.slice(0, 100),
        preview4: at4.slice(0, 100),
      });
    }

    if (failures.length) {
      console.error("FAIL\n" + failures.join("\n\n"));
      process.exitCode = 1;
    } else {
      console.log("PASS 5-recipe step scaling");
      console.log(JSON.stringify(results, null, 2));
    }
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
