/**
 * Upload local recipe photos → Supabase Storage `img` bucket,
 * then UPDATE recipes.image_url for matched titles.
 *
 * Usage:
 *   node scripts/upload-recipe-images.mjs
 *   node scripts/upload-recipe-images.mjs --dir "C:\path\to\photos"
 *   node scripts/upload-recipe-images.mjs --dry-run
 *
 * Requires in .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY  (storage upload + recipes update)
 */
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");

const BUCKET = "img";
const DEFAULT_DIR = String.raw`C:\Users\dydtj\Desktop\어플개발\음식사진`;
const IMAGE_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"]);

/** Local basename (no ext) → recipe title when names differ */
const TITLE_ALIASES = {
  "soy bulgogi": "간장 불고기",
};

function loadEnvLocal() {
  const p = path.join(ROOT, ".env.local");
  if (!fs.existsSync(p)) {
    throw new Error(`.env.local not found at ${p}`);
  }
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

function parseArgs(argv) {
  let dir = DEFAULT_DIR;
  let dryRun = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") dryRun = true;
    else if (a === "--dir" && argv[i + 1]) {
      dir = argv[++i];
    }
  }
  return { dir, dryRun };
}

/** "2.계란볶음밥" / "3. 두부조림" / "soy bulgogi" → match key */
function stemFromFilename(filename) {
  const base = path.parse(filename).name;
  return base.replace(/^\d+\.\s*/, "").trim();
}

function normalizeKey(s) {
  return s
    .normalize("NFC")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function resolveTitle(stem, recipeByNormTitle) {
  const key = normalizeKey(stem);
  const aliased = TITLE_ALIASES[key];
  if (aliased) {
    const hit = recipeByNormTitle.get(normalizeKey(aliased));
    if (hit) return hit;
  }
  return recipeByNormTitle.get(key) ?? null;
}

/** Safe object path inside the bucket (ASCII only — Storage rejects non-ASCII keys) */
function storageObjectPath(recipeId, ext) {
  const e = ext.toLowerCase() === ".jpeg" ? ".jpg" : ext.toLowerCase();
  const safeExt = [".jpg", ".png", ".webp", ".gif", ".avif"].includes(e)
    ? e
    : ".jpg";
  return `recipes/${recipeId}${safeExt}`;
}

function contentTypeForExt(ext) {
  const e = ext.toLowerCase();
  if (e === ".png") return "image/png";
  if (e === ".webp") return "image/webp";
  if (e === ".gif") return "image/gif";
  if (e === ".avif") return "image/avif";
  return "image/jpeg";
}

async function ensureBucket(supabase) {
  const { data: buckets, error } = await supabase.storage.listBuckets();
  if (error) throw new Error(`listBuckets: ${error.message}`);
  const existing = (buckets ?? []).find((b) => b.name === BUCKET);
  if (existing) {
    if (!existing.public) {
      console.log(`Bucket "${BUCKET}" is private — updating to public...`);
      const { error: updErr } = await supabase.storage.updateBucket(BUCKET, {
        public: true,
      });
      if (updErr) {
        console.warn(
          `  could not set public: ${updErr.message} (will still upload; use signed URLs if needed)`,
        );
      } else {
        console.log(`Bucket "${BUCKET}" is now public`);
      }
    } else {
      console.log(`Bucket "${BUCKET}" exists (public=true)`);
    }
    return existing;
  }
  console.log(`Creating public bucket "${BUCKET}"...`);
  const { data, error: createErr } = await supabase.storage.createBucket(
    BUCKET,
    {
      public: true,
      fileSizeLimit: 10 * 1024 * 1024,
      allowedMimeTypes: [
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/gif",
        "image/avif",
      ],
    },
  );
  if (createErr) throw new Error(`createBucket: ${createErr.message}`);
  return data;
}

async function main() {
  const { dir, dryRun } = parseArgs(process.argv.slice(2));
  const env = loadEnvLocal();

  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey =
    env.SUPABASE_SERVICE_ROLE_KEY ||
    env.SERVICE_ROLE_KEY ||
    env.SUPABASE_SERVICE_KEY;
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL in .env.local");
    process.exit(1);
  }
  if (!dryRun && !serviceKey) {
    console.error(
      "Missing SUPABASE_SERVICE_ROLE_KEY in .env.local (required for Storage upload + recipes UPDATE)",
    );
    process.exit(1);
  }
  if (dryRun && !serviceKey && !anonKey) {
    console.error(
      "Need NEXT_PUBLIC_SUPABASE_ANON_KEY (dry-run) or SUPABASE_SERVICE_ROLE_KEY",
    );
    process.exit(1);
  }

  if (!fs.existsSync(dir)) {
    console.error(`Image directory not found:\n  ${dir}`);
    process.exit(1);
  }

  const files = fs
    .readdirSync(dir)
    .filter((name) => IMAGE_EXTS.has(path.extname(name).toLowerCase()))
    .sort((a, b) => a.localeCompare(b, "ko"));

  console.log(`\nSource dir: ${dir}`);
  console.log(`Images found: ${files.length}`);
  if (dryRun) console.log("Mode: DRY-RUN (no upload / no DB write)\n");

  const supabase = createClient(url, serviceKey || anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (!dryRun) {
    await ensureBucket(supabase);
  }

  const { data: recipes, error: recipesErr } = await supabase
    .from("recipes")
    .select("id, title, image_url")
    .order("title");

  if (recipesErr) {
    console.error("Failed to load recipes:", recipesErr.message);
    process.exit(1);
  }

  const recipeByNormTitle = new Map();
  for (const r of recipes ?? []) {
    recipeByNormTitle.set(normalizeKey(r.title), r);
  }

  const matched = [];
  const unmatchedFiles = [];

  for (const filename of files) {
    const stem = stemFromFilename(filename);
    const recipe = resolveTitle(stem, recipeByNormTitle);
    if (!recipe) {
      unmatchedFiles.push(filename);
      continue;
    }
    matched.push({
      filename,
      absPath: path.join(dir, filename),
      ext: path.extname(filename),
      recipe,
      objectPath: storageObjectPath(recipe.id, path.extname(filename)),
    });
  }

  // Prefer first file if multiple map to same recipe
  const byRecipeId = new Map();
  for (const m of matched) {
    if (!byRecipeId.has(m.recipe.id)) byRecipeId.set(m.recipe.id, m);
  }
  const jobs = [...byRecipeId.values()];

  console.log(`Matched: ${jobs.length}`);
  if (unmatchedFiles.length) {
    console.log("Unmatched files:");
    for (const f of unmatchedFiles) console.log(`  - ${f}`);
  }

  const results = { ok: 0, fail: 0 };

  for (const job of jobs) {
    const { recipe, absPath, objectPath, filename, ext } = job;
    const publicUrl = `${url}/storage/v1/object/public/${BUCKET}/${objectPath
      .split("/")
      .map(encodeURIComponent)
      .join("/")}`;

    console.log(`\n→ ${filename}`);
    console.log(`   recipe: ${recipe.title} (${recipe.id})`);
    console.log(`   storage: ${BUCKET}/${objectPath}`);

    if (dryRun) {
      console.log(`   would set image_url: ${publicUrl}`);
      results.ok++;
      continue;
    }

    const buffer = fs.readFileSync(absPath);
    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(objectPath, buffer, {
        contentType: contentTypeForExt(ext),
        upsert: true,
        cacheControl: "31536000",
      });

    if (upErr) {
      console.error(`   upload FAILED: ${upErr.message}`);
      results.fail++;
      continue;
    }

    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(objectPath);
    const imageUrl = pub?.publicUrl || publicUrl;

    const { error: updErr } = await supabase
      .from("recipes")
      .update({ image_url: imageUrl })
      .eq("id", recipe.id);

    if (updErr) {
      console.error(`   DB update FAILED: ${updErr.message}`);
      results.fail++;
      continue;
    }

    console.log(`   OK → ${imageUrl}`);
    results.ok++;
  }

  const unmatchedRecipes = (recipes ?? []).filter(
    (r) => !jobs.some((j) => j.recipe.id === r.id),
  );
  if (unmatchedRecipes.length) {
    console.log("\nRecipes without a matching local file:");
    for (const r of unmatchedRecipes) console.log(`  - ${r.title}`);
  }

  console.log(`\nDone. ok=${results.ok} fail=${results.fail}`);
  if (results.fail > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
