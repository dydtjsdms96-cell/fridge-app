const fs = require("fs");
const path = require("path");

function loadEnvLocal() {
  const p = path.join(process.cwd(), ".env.local");
  const text = fs.readFileSync(p, "utf8");
  const env = {};
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
    env[k] = v;
  }
  return env;
}

function namesOnly(env) {
  return Object.keys(env).sort();
}

function hasServiceRoleName(env) {
  const candidates = [
    "SUPABASE_SERVICE_ROLE_KEY",
    "SERVICE_ROLE_KEY",
    "SUPABASE_SERVICE_KEY",
  ];
  return candidates.filter((n) => Object.prototype.hasOwnProperty.call(env, n));
}

async function restCount(url, key, table) {
  const res = await fetch(`${url}/rest/v1/${table}?select=*`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Prefer: "count=exact",
      Range: "0-0",
    },
  });
  const contentRange = res.headers.get("content-range");
  const bodyText = await res.text();
  let bodyPreview = bodyText.slice(0, 300);
  try {
    const j = JSON.parse(bodyText);
    bodyPreview = Array.isArray(j)
      ? `array(len=${j.length})`
      : typeof j;
  } catch {}
  return {
    status: res.status,
    contentRange,
    bodyPreview,
    ok: res.ok,
  };
}

async function main() {
  const env = loadEnvLocal();
  console.log("=== ENV NAMES (from .env.local via node) ===");
  console.log(namesOnly(env).join("\n"));

  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
    process.exit(1);
  }

  const serviceNames = hasServiceRoleName(env);
  console.log("\n=== SERVICE ROLE KEY DETECTION (names only) ===");
  console.log(
    serviceNames.length
      ? `Found keys: ${serviceNames.join(", ")}`
      : "No SERVICE_ROLE-related key name found in .env.local"
  );

  const { createClient } = await import("@supabase/supabase-js");
  const userClient = createClient(url, anon);

  console.log("\n=== SIGN IN test@fridge.app ===");
  const { data: authData, error: authErr } = await userClient.auth.signInWithPassword({
    email: "test@fridge.app",
    password: "test",
  });
  if (authErr) {
    console.log("signIn error:", authErr.message);
  } else {
    console.log(
      "signed in ok:",
      !!authData.session,
      "user:",
      authData.user?.id,
      authData.user?.email
    );
  }

  console.log("\n=== USER SESSION: recipes + recipe_ingredients ===");
  let recipes = null;
  let recipesErr = null;
  {
    const r = await userClient
      .from("recipes")
      .select("id, title, recipe_ingredients(id, name, ingredient_name, amount)")
      .order("title");
    recipes = r.data;
    recipesErr = r.error;
    if (recipesErr) {
      const r2 = await userClient
        .from("recipes")
        .select("id, title, recipe_ingredients(*)")
        .order("title");
      recipes = r2.data;
      recipesErr = r2.error;
    }
  }
  if (recipesErr) {
    console.log("recipes error:", recipesErr.code, recipesErr.message, recipesErr.details, recipesErr.hint);
  } else {
    console.log("recipes count:", recipes?.length ?? 0);
    for (const r of recipes || []) {
      const ings = r.recipe_ingredients || [];
      console.log(
        `- ${r.title} (${r.id}) ingredients=${ings.length}:`,
        ings.map((i) => i.name || i.ingredient_name || JSON.stringify(i)).join(", ")
      );
    }
  }

  console.log("\n=== USER SESSION: fridge_items status=보유 ===");
  const { data: fridge, error: fridgeErr } = await userClient
    .from("fridge_items")
    .select("id, name, status, user_id")
    .eq("status", "보유");
  if (fridgeErr) {
    console.log("fridge_items error:", fridgeErr.code, fridgeErr.message);
  } else {
    console.log("fridge_items count:", fridge?.length ?? 0);
    for (const f of fridge || []) {
      console.log(`- ${f.name} (${f.status})`);
    }
  }

  function fulfillment(recipesRows, fridgeRows) {
    const have = new Set(
      (fridgeRows || []).map((f) => (f.name || "").trim().toLowerCase())
    );
    for (const r of recipesRows || []) {
      const ings = (r.recipe_ingredients || []).map(
        (i) => (i.name || i.ingredient_name || "").trim()
      );
      const matched = ings.filter((n) => have.has(n.toLowerCase())).length;
      console.log(`fulfillment ${r.title}: ${matched}/${ings.length}`);
    }
  }

  if (!recipesErr && !fridgeErr) {
    console.log("\n=== FULFILLMENT (user session) ===");
    fulfillment(recipes, fridge);
  }

  console.log("\n=== REST count=exact (anon key) /recipes ===");
  const restAnon = await restCount(url, anon, "recipes");
  console.log(JSON.stringify(restAnon, null, 2));

  if (authData?.session?.access_token) {
    console.log("\n=== REST count=exact (user JWT) /recipes ===");
    const restUser = await fetch(`${url}/rest/v1/recipes?select=*`, {
      headers: {
        apikey: anon,
        Authorization: `Bearer ${authData.session.access_token}`,
        Prefer: "count=exact",
        Range: "0-0",
      },
    });
    console.log(
      JSON.stringify(
        {
          status: restUser.status,
          contentRange: restUser.headers.get("content-range"),
          ok: restUser.ok,
        },
        null,
        2
      )
    );
  }

  const serviceKeyName = serviceNames[0];
  const serviceKey = serviceKeyName ? env[serviceKeyName] : null;

  if (!serviceKey) {
    console.log("\n=== SERVICE ROLE PATH SKIPPED (no key in .env.local) ===");
    console.log(
      "Cannot bypass RLS or seed without SUPABASE_SERVICE_ROLE_KEY. Bug diagnosis incomplete for RLS vs empty table."
    );
    return;
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log("\n=== SERVICE ROLE: recipes count (bypass RLS) ===");
  const { data: adminRecipes, error: adminErr, count } = await admin
    .from("recipes")
    .select("id, title, recipe_ingredients(*)", {
      count: "exact",
    });
  if (adminErr) {
    console.log("admin recipes error:", adminErr.code, adminErr.message);
  } else {
    console.log("admin recipes count (count param):", count);
    console.log("admin recipes rows:", adminRecipes?.length ?? 0);
    for (const r of adminRecipes || []) {
      const ings = r.recipe_ingredients || [];
      console.log(
        `- ${r.title}:`,
        ings.map((i) => i.name || i.ingredient_name || JSON.stringify(i)).join(", ")
      );
    }
  }

  console.log("\n=== REST count=exact (service role) /recipes ===");
  const restSvc = await restCount(url, serviceKey, "recipes");
  console.log(
    JSON.stringify(
      {
        status: restSvc.status,
        contentRange: restSvc.contentRange,
        ok: restSvc.ok,
        bodyPreview: restSvc.bodyPreview,
      },
      null,
      2
    )
  );

  const adminCount = count ?? adminRecipes?.length ?? 0;
  const userCount = recipes?.length ?? 0;

  console.log("\n=== RLS DIAGNOSIS ===");
  if (!adminErr && adminCount > 0 && userCount === 0) {
    console.log(
      "BUG CONFIRMED: service role sees recipes but user/anon cannot → RLS without SELECT policy (or policy excludes user)."
    );
  } else if (!adminErr && adminCount === 0) {
    console.log("Service role shows 0 recipes → table empty; will seed.");
  } else if (userCount > 0) {
    console.log("User can see recipes; not an empty-SELECT RLS bug (or policies allow read).");
  } else {
    console.log("Inconclusive.");
  }

  if (!adminErr && adminCount === 0) {
    console.log("\n=== SEEDING two recipes via service role ===");
    const seeds = [
      { title: "계란찜", ingredients: ["계란", "우유"] },
      { title: "닭가슴살 브로콜리 볶음", ingredients: ["닭가슴살", "브로콜리"] },
    ];

    for (const s of seeds) {
      const { data: inserted, error: insErr } = await admin
        .from("recipes")
        .insert({ title: s.title })
        .select("id, title")
        .single();
      if (insErr) {
        console.log(`insert recipe ${s.title} error:`, insErr.message);
        continue;
      }
      console.log("inserted recipe:", inserted.title, inserted.id);

      const rowsName = s.ingredients.map((name) => ({
        recipe_id: inserted.id,
        name,
      }));
      let r1 = await admin.from("recipe_ingredients").insert(rowsName).select("*");
      if (r1.error) {
        const rowsIng = s.ingredients.map((ingredient_name) => ({
          recipe_id: inserted.id,
          ingredient_name,
        }));
        r1 = await admin.from("recipe_ingredients").insert(rowsIng).select("*");
      }
      if (r1.error) {
        console.log("insert ingredients error:", r1.error.message);
      } else {
        console.log(
          "inserted ingredients:",
          (r1.data || []).map((x) => x.name || x.ingredient_name).join(", ")
        );
      }
    }

    console.log("\n=== VERIFY nested select with user session after seed ===");
    const { data: recipes2, error: recipes2Err } = await userClient
      .from("recipes")
      .select("id, title, recipe_ingredients(*)")
      .order("title");
    if (recipes2Err) {
      console.log("post-seed user recipes error:", recipes2Err.message);
    } else {
      console.log("post-seed user recipes count:", recipes2?.length ?? 0);
      for (const r of recipes2 || []) {
        const ings = r.recipe_ingredients || [];
        console.log(
          `- ${r.title}:`,
          ings.map((i) => i.name || i.ingredient_name).join(", ")
        );
      }
      console.log("\n=== FULFILLMENT after seed ===");
      fulfillment(recipes2, fridge);
    }

    console.log("\n=== REST count after seed (service) ===");
    const restAfter = await restCount(url, serviceKey, "recipes");
    console.log("content-range:", restAfter.contentRange, "status:", restAfter.status);
  }
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
