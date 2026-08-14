/**
 * Replace ingredient amounts in recipes.steps with {{ing:재료명}} placeholders.
 *
 * Usage:
 *   node scripts/apply-step-placeholders.mjs --dry-run
 *   node scripts/apply-step-placeholders.mjs --apply
 *   node scripts/apply-step-placeholders.mjs --apply --only=로제 떡볶이,카레라이스
 *
 * Requires .env.local: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

/**
 * Sentence wording → recipe_ingredients.ingredient_name
 * Keys = canonical DB names; values = alternate phrases found in steps.
 */
const INGREDIENT_ALIASES = {
  체다치즈: ["슬라이스 치즈"],
  닭고기: ["닭다리살", "닭다리순살"],
  골뱅이통조림: ["통조림 골뱅이"],
  카레가루: ["카레 가루"],
};

function labelsForIngredient(canonical) {
  const aliases = INGREDIENT_ALIASES[canonical] ?? [];
  // Longer labels first so "닭다리살" wins over a shorter accidental match
  return [canonical, ...aliases].sort((a, b) => b.length - a.length);
}

/** Find the rightmost occurrence of canonical name or any alias in `before`. */
function findIngredientLabel(before, canonical) {
  let best = null;
  for (const label of labelsForIngredient(canonical)) {
    const idx = before.lastIndexOf(label);
    if (idx < 0) continue;
    if (
      !best ||
      idx > best.idx ||
      (idx === best.idx && label.length > best.label.length)
    ) {
      best = { idx, label };
    }
  }
  return best;
}

function parseOnlyTitles(argv) {
  const arg = argv.find((a) => a.startsWith("--only="));
  if (!arg) return null;
  return new Set(
    arg
      .slice("--only=".length)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

function loadEnvLocal() {
  const p = path.join(ROOT, ".env.local");
  const text = fs.readFileSync(p, "utf8");
  const env = { ...process.env };
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i <= 0) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (env[k] == null || env[k] === "") env[k] = v;
  }
  return env;
}

function approxEqual(a, b) {
  const x = Number(a);
  const y = Number(b);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
  return Math.abs(x - y) < 1e-6 || Math.abs(x - y) < Math.max(1, Math.abs(y)) * 0.02;
}

/** Parse Korean-ish amount tokens: 1.5, 0.5, 1/4, ½, 1¼ etc. */
function parseAmountToken(raw) {
  const s = String(raw).trim().replace(/,/g, "");
  if (/^\d+(?:\.\d+)?$/.test(s)) return Number(s);
  const frac = s.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (frac) return Number(frac[1]) / Number(frac[2]);
  const mixed = s.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)$/);
  if (mixed)
    return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  return null;
}

function amountVariants(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return [];
  const out = new Set();
  const push = (s) => {
    if (s) out.add(s);
  };
  push(String(n));
  if (Number.isInteger(n)) push(String(n));
  else {
    push(n.toFixed(1).replace(/\.0$/, ""));
    push(n.toFixed(2).replace(/0+$/, "").replace(/\.$/, ""));
  }
  // common fractions
  const fracMap = [
    [0.25, ["1/4", "¼"]],
    [0.33, ["1/3", "⅓"]],
    [0.34, ["1/3"]],
    [1 / 3, ["1/3", "⅓"]],
    [0.5, ["1/2", "½"]],
    [0.66, ["2/3"]],
    [0.67, ["2/3", "⅔"]],
    [2 / 3, ["2/3", "⅔"]],
    [0.75, ["3/4", "¾"]],
    [0.2, ["1/5"]],
    [0.8, ["4/5"]],
  ];
  for (const [v, labels] of fracMap) {
    if (approxEqual(n, v)) labels.forEach(push);
  }
  return [...out];
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function unitAliases(unit) {
  const u = (unit ?? "").trim();
  if (!u) return [];
  const map = {
    g: ["g", "G", "그램", "그람"],
    kg: ["kg", "KG", "킬로", "킬로그램"],
    ml: ["ml", "mL", "ML", "밀리리터"],
    큰술: ["큰술", "Ts", "T", "테이블스푼"],
    작은술: ["작은술", "ts", "t", "티스푼"],
    개: ["개"],
    대: ["대"],
    봉: ["봉", "봉지"],
    컵: ["컵", "cup"],
    모: ["모"],
    캔: ["캔"],
    장: ["장"],
    쪽: ["쪽"],
    팩: ["팩"],
    마리: ["마리"],
    사리: ["사리"],
    단: ["단"],
    조각: ["조각"],
    알: ["알"],
    공기: ["공기"],
    줄: ["줄"],
    장: ["장"],
  };
  const key = Object.keys(map).find((k) => k === u || map[k].includes(u));
  if (key) return map[key];
  return [u];
}

/** Time / non-ingredient unit suffixes that must never be replaced alone. */
const TIME_OR_NON_ING_UNITS =
  /(?:분|분간|시간|시간동안|초|초간|도|℃|°C|회|번|단계|인분)/;

function isNearTimeContext(text, index) {
  const after = text.slice(index, index + 12);
  if (TIME_OR_NON_ING_UNITS.test(after)) return true;
  return false;
}

/**
 * Find amount+unit spans that clearly belong to an ingredient name nearby.
 * Prefer: 재료명 … 수량단위  (name within ~12 chars before amount)
 */
function findReplacements(content, ingredients) {
  if (!content) {
    return { next: content, replacements: [], skipped: [], ambiguous: [] };
  }

  /** @type {{ start:number, end:number, name:string, matched:string }[]} */
  const candidates = [];
  const skipped = [];
  const ambiguous = [];

  // Collect all amount+unit occurrences first
  // Allow Korean particles after units (을/를/은/는/와/과…). Block only Latin letters
  // so "30g은", "1.5큰술을", "0.5개와" still match the amount+unit span.
  const amountUnitRe =
    /(\d+(?:\.\d+)?|\d+\s*\/\s*\d+|½|¼|¾|⅓|⅔)\s*(큰술|작은술|스푼|티스푼|g|G|그램|그람|kg|KG|킬로그램|ml|mL|ML|밀리리터|컵|개|대|봉|봉지|모|캔|장|쪽|팩|마리|사리|단|조각|알|공기|줄|Ts|T|ts|t)(?![a-zA-Z])/g;

  /** @type {{ start:number, end:number, amountRaw:string, unitRaw:string, amount:number|null }[]} */
  const spans = [];
  let m;
  while ((m = amountUnitRe.exec(content)) !== null) {
    // Skip matches that fall inside an existing {{ing:...}} placeholder
    const absStart = m.index;
    const absEnd = m.index + m[0].length;
    if (/\{\{ing:[^}]*$/.test(content.slice(Math.max(0, absStart - 40), absStart))) {
      continue;
    }
    if (content.slice(0, absStart).includes("{{ing:") && content.slice(absStart).startsWith("")) {
      // no-op; covered below
    }
    // If this span overlaps any existing placeholder region, skip
    let insidePh = false;
    for (const ph of content.matchAll(/\{\{ing:[^}]+\}\}/g)) {
      const ps = ph.index ?? 0;
      const pe = ps + ph[0].length;
      if (absStart < pe && absEnd > ps) {
        insidePh = true;
        break;
      }
    }
    if (insidePh) continue;

    const amountRaw = m[1];
    const unitRaw = m[2];
    const start = absStart;
    const end = absEnd;
    // "1큰술씩" 등 애매
    const after = content.slice(end, end + 2);
    if (after.startsWith("씩") || after.startsWith("씩 ")) {
      skipped.push({
        reason: "애매한 분배 표현(씩)",
        snippet: content.slice(Math.max(0, start - 8), end + 4),
      });
      continue;
    }
    const amount = parseAmountToken(
      amountRaw
        .replace(/½/, "1/2")
        .replace(/¼/, "1/4")
        .replace(/¾/, "3/4")
        .replace(/⅓/, "1/3")
        .replace(/⅔/, "2/3"),
    );
    spans.push({ start, end, amountRaw, unitRaw, amount, text: m[0] });
  }

  // Also catch "약간" never — skip
  // Match each span to ingredient by name proximity + amount/unit match
  for (const span of spans) {
    const before = content.slice(Math.max(0, span.start - 40), span.start);
    const matches = [];

    for (const ing of ingredients) {
      const name = ing.ingredient_name;
      if (!name) continue;
      const amount = Number(ing.amount);
      const unit = (ing.unit ?? "").trim();
      if (!Number.isFinite(amount) || amount <= 0 || !unit) continue;

      // Canonical name or configured alias (슬라이스 치즈 → 체다치즈, etc.)
      const found = findIngredientLabel(before, name);
      if (!found) continue;
      const between = before.slice(found.idx + found.label.length);
      if (between.length > 28) continue;

      // Allow: "재료 1개(" before a parenthetical gram equivalent "150g)"
      // Reject other digit-bearing gaps (another amount already between name and span).
      const betweenNoParenOpen = between.replace(/\([^)]*$/g, "");
      const stripped = betweenNoParenOpen.replace(/\([^)]*\)/g, "");
      const parenEquivalent =
        /^\s*(?:\d+(?:\.\d+)?|\d+\s*\/\s*\d+|½|¼|¾|⅓|⅔)\s*(?:큰술|작은술|개|컵|모|대|공기|캔|장|g|그램)?\s*\(\s*$/.test(
          between,
        ) || /^\s*\(\s*$/.test(between);
      if (/\d/.test(stripped) && !parenEquivalent) continue;

      const unitOk = unitAliases(unit).some(
        (a) => a.toLowerCase() === span.unitRaw.toLowerCase() || a === span.unitRaw,
      );
      // 봉 vs 봉지
      const unitOkLoose =
        unitOk ||
        (unit === "봉" && span.unitRaw.startsWith("봉")) ||
        (unit === "봉지" && span.unitRaw.startsWith("봉"));

      const variants = amountVariants(amount);
      const amountOk =
        span.amount != null &&
        (variants.some((v) => {
          const pv = parseAmountToken(v);
          return pv != null && approxEqual(pv, span.amount);
        }) ||
          approxEqual(amount, span.amount));

      if (unitOkLoose && amountOk) {
        matches.push({ name, distance: between.length });
      }
    }

    if (matches.length === 1) {
      candidates.push({
        start: span.start,
        end: span.end,
        name: matches[0].name,
        matched: span.text,
      });
    } else if (matches.length > 1) {
      // pick closest name
      matches.sort((a, b) => a.distance - b.distance);
      if (matches[0].distance < matches[1].distance) {
        candidates.push({
          start: span.start,
          end: span.end,
          name: matches[0].name,
          matched: span.text,
        });
        ambiguous.push({
          reason: "여러 재료 후보 중 가장 가까운 것 선택",
          snippet: content.slice(Math.max(0, span.start - 20), span.end + 8),
          chosen: matches[0].name,
          candidates: matches.map((x) => x.name),
        });
      } else {
        skipped.push({
          reason: "여러 재료 후보 동점",
          snippet: content.slice(Math.max(0, span.start - 20), span.end + 8),
        });
      }
    } else {
      // amount+unit present near some ingredient name but no amount match — or orphan
      const nearName = ingredients.find((ing) => {
        const n = ing.ingredient_name;
        if (!n) return false;
        return findIngredientLabel(before, n) != null;
      });
      if (nearName) {
        skipped.push({
          reason: "재료명 근처이나 수량/단위가 recipe_ingredients와 불일치",
          snippet: content.slice(Math.max(0, span.start - 24), span.end + 6),
          near: nearName.ingredient_name,
        });
      } else if (span.amount != null) {
        // Same amount+unit as some ingredient but different wording in the sentence
        const soft = ingredients.filter((ing) => {
          const amount = Number(ing.amount);
          const unit = (ing.unit ?? "").trim();
          if (!Number.isFinite(amount) || !unit) return false;
          const unitOk = unitAliases(unit).some(
            (a) =>
              a.toLowerCase() === span.unitRaw.toLowerCase() ||
              a === span.unitRaw,
          );
          return unitOk && approxEqual(amount, span.amount);
        });
        if (soft.length === 1) {
          ambiguous.push({
            reason:
              "수량은 재료 목록과 일치하나 문장 속 재료 표기가 달라 치환하지 않음",
            snippet: content.slice(Math.max(0, span.start - 24), span.end + 6),
            ingredient: soft[0].ingredient_name,
          });
        }
      }
    }
  }

  // Detect repeated ingredient name mentions (name appears >1 without amount on second)
  for (const ing of ingredients) {
    const name = ing.ingredient_name;
    if (!name) continue;
    let idx = 0;
    let count = 0;
    while ((idx = content.indexOf(name, idx)) !== -1) {
      count++;
      idx += name.length;
    }
    if (count >= 2) {
      ambiguous.push({
        reason: "재료명이 문장에 2회 이상 등장",
        name,
        contentSnippet: content.length > 120 ? content.slice(0, 120) + "…" : content,
      });
    }
  }

  // Apply replacements from end to start (no overlap)
  candidates.sort((a, b) => b.start - a.start);
  let next = content;
  const applied = [];
  const usedRanges = [];
  for (const c of candidates) {
    if (usedRanges.some((r) => !(c.end <= r.start || c.start >= r.end))) continue;
    // Don't replace inside existing placeholder (none yet)
    const placeholder = `{{ing:${c.name}}}`;
    next = next.slice(0, c.start) + placeholder + next.slice(c.end);
    usedRanges.push({ start: c.start, end: c.end });
    applied.push(c);
  }

  return { next, replacements: applied.reverse(), skipped, ambiguous };
}

async function main() {
  const apply = process.argv.includes("--apply");
  const dryRun = !apply;
  const onlyTitles = parseOnlyTitles(process.argv);

  const env = loadEnvLocal();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env");

  const supabase = createClient(url, key);

  const { data: recipes, error } = await supabase
    .from("recipes")
    .select(
      `
      id,
      title,
      steps,
      recipe_ingredients (
        ingredient_name,
        amount,
        unit
      )
    `,
    )
    .order("title");

  if (error) throw error;

  const report = {
    recipesTouched: 0,
    sentencesChanged: 0,
    totalReplacements: 0,
    skipped: [],
    ambiguous: [],
    perRecipe: [],
  };

  const updates = [];

  for (const recipe of recipes ?? []) {
    if (onlyTitles && !onlyTitles.has(recipe.title)) continue;

    const ingredients = recipe.recipe_ingredients ?? [];
    const steps = Array.isArray(recipe.steps) ? recipe.steps : [];
    let changedSentences = 0;
    let recipeReplacements = 0;
    const newSteps = steps.map((s) => {
      const content = s.content ?? "";
      const { next, replacements, skipped, ambiguous } = findReplacements(
        content,
        ingredients,
      );
      for (const sk of skipped) {
        report.skipped.push({ title: recipe.title, step: s.step, ...sk });
      }
      for (const am of ambiguous) {
        report.ambiguous.push({ title: recipe.title, step: s.step, ...am });
      }
      if (next !== content) {
        changedSentences++;
        recipeReplacements += replacements.length;
        return { ...s, content: next };
      }
      return s;
    });

    if (changedSentences > 0) {
      report.recipesTouched++;
      report.sentencesChanged += changedSentences;
      report.totalReplacements += recipeReplacements;
      report.perRecipe.push({
        title: recipe.title,
        sentences: changedSentences,
        replacements: recipeReplacements,
      });
      updates.push({ id: recipe.id, title: recipe.title, steps: newSteps });
    }
  }

  const outPath = path.join(ROOT, "scripts", "step-placeholder-report.json");
  fs.writeFileSync(
    outPath,
    JSON.stringify(
      {
        dryRun,
        summary: {
          recipesTouched: report.recipesTouched,
          sentencesChanged: report.sentencesChanged,
          totalReplacements: report.totalReplacements,
          skippedCount: report.skipped.length,
          ambiguousCount: report.ambiguous.length,
        },
        skipped: report.skipped,
        ambiguous: report.ambiguous,
        perRecipe: report.perRecipe,
        updates: updates.map((u) => ({
          id: u.id,
          title: u.title,
          steps: u.steps,
        })),
      },
      null,
      2,
    ),
    "utf8",
  );

  console.log(
    JSON.stringify(
      {
        dryRun,
        recipesTouched: report.recipesTouched,
        sentencesChanged: report.sentencesChanged,
        totalReplacements: report.totalReplacements,
        skipped: report.skipped.length,
        ambiguous: report.ambiguous.length,
        report: outPath,
      },
      null,
      2,
    ),
  );

  if (dryRun) {
    console.log("Dry run only. Re-run with --apply to write DB.");
    return;
  }

  let ok = 0;
  for (const u of updates) {
    const { error: upErr } = await supabase
      .from("recipes")
      .update({ steps: u.steps })
      .eq("id", u.id);
    if (upErr) {
      console.error("Update failed", u.title, upErr.message);
    } else {
      ok++;
    }
  }
  console.log(`Updated ${ok}/${updates.length} recipes`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
