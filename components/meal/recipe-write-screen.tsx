"use client";

import type { ReactNode } from "react";
import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Camera,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase";
import { uploadRecipePhoto } from "@/lib/recipe-photo-upload";
import type {
  DishType,
  Recipe,
  RecipeDifficulty,
  RecipeIngredient,
  RecipeStep,
} from "@/types/database";

type IngDraft = {
  key: string;
  ingredient_name: string;
  amount: string;
  unit: string;
};

type StepDraft = {
  key: string;
  content: string;
};

const DIFFICULTIES: RecipeDifficulty[] = ["쉬움", "보통", "어려움"];
const DISH_TYPES: DishType[] = ["메인요리", "밑반찬"];

function newKey() {
  return crypto.randomUUID();
}

type RecipeWriteScreenProps = {
  userId: string;
  mode: "create" | "edit";
  initialRecipe?: Recipe | null;
  initialIngredients?: RecipeIngredient[];
};

export function RecipeWriteScreen({
  userId,
  mode,
  initialRecipe = null,
  initialIngredients = [],
}: RecipeWriteScreenProps) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState(initialRecipe?.title ?? "");
  const [cookMinutes, setCookMinutes] = useState(
    initialRecipe?.cook_minutes != null
      ? String(initialRecipe.cook_minutes)
      : "",
  );
  const [difficulty, setDifficulty] = useState<RecipeDifficulty>(
    initialRecipe?.difficulty ?? "쉬움",
  );
  const [dishType, setDishType] = useState<DishType>(
    initialRecipe?.dish_type ?? "메인요리",
  );
  const [baseServings, setBaseServings] = useState(
    String(initialRecipe?.base_servings ?? 1),
  );
  const [imageUrl, setImageUrl] = useState<string | null>(
    initialRecipe?.image_url ?? null,
  );
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(
    initialRecipe?.image_url ?? null,
  );

  const [ingredients, setIngredients] = useState<IngDraft[]>(() => {
    if (initialIngredients.length > 0) {
      return initialIngredients.map((ing) => ({
        key: ing.id || newKey(),
        ingredient_name: ing.ingredient_name,
        amount: ing.amount != null ? String(ing.amount) : "",
        unit: ing.unit ?? "",
      }));
    }
    return [{ key: newKey(), ingredient_name: "", amount: "", unit: "" }];
  });

  const [steps, setSteps] = useState<StepDraft[]>(() => {
    const raw = (initialRecipe?.steps ?? []) as RecipeStep[];
    if (raw.length > 0) {
      return [...raw]
        .sort((a, b) => a.step - b.step)
        .map((s) => ({ key: newKey(), content: s.content }));
    }
    return [{ key: newKey(), content: "" }];
  });

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const heading = mode === "edit" ? "레시피 수정" : "내 레시피 추가";

  const canSubmit = useMemo(() => {
    if (!title.trim()) return false;
    if (!ingredients.some((i) => i.ingredient_name.trim())) return false;
    return true;
  }, [title, ingredients]);

  function onPickFile(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("이미지 파일만 올릴 수 있어요");
      return;
    }
    setImageFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setError(null);
  }

  function clearImage() {
    setImageFile(null);
    setPreviewUrl(null);
    setImageUrl(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  function updateIng(key: string, patch: Partial<IngDraft>) {
    setIngredients((prev) =>
      prev.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    );
  }

  function removeIng(key: string) {
    setIngredients((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((r) => r.key !== key);
    });
  }

  function moveStep(index: number, dir: -1 | 1) {
    setSteps((prev) => {
      const next = [...prev];
      const j = index + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[index], next[j]] = [next[j], next[index]];
      return next;
    });
  }

  async function handleSave() {
    if (busy || !canSubmit) return;
    setBusy(true);
    setError(null);

    try {
      const supabase = createClient();
      const recipeId = initialRecipe?.id ?? crypto.randomUUID();
      const servings = Math.max(1, Math.floor(Number(baseServings) || 1));
      const minutesRaw = cookMinutes.trim();
      const minutes =
        minutesRaw === "" ? null : Math.max(0, Math.floor(Number(minutesRaw)));

      const stepPayload: RecipeStep[] = steps
        .map((s) => s.content.trim())
        .filter(Boolean)
        .map((content, i) => ({ step: i + 1, content }));

      const ingRows = ingredients
        .map((row) => ({
          ingredient_name: row.ingredient_name.trim(),
          amount:
            row.amount.trim() === ""
              ? null
              : Number(row.amount.replace(/,/g, "")),
          unit: row.unit.trim() || null,
        }))
        .filter((r) => r.ingredient_name);

      if (ingRows.length === 0) {
        setError("재료를 하나 이상 입력해 주세요");
        return;
      }

      let nextImageUrl = imageUrl;
      if (imageFile) {
        nextImageUrl = await uploadRecipePhoto({
          userId,
          recipeId,
          file: imageFile,
        });
      }

      const recipeRow = {
        id: recipeId,
        title: title.trim(),
        cook_minutes: minutes != null && Number.isFinite(minutes) ? minutes : null,
        difficulty,
        dish_type: dishType,
        base_servings: servings,
        steps: stepPayload,
        image_url: nextImageUrl,
        source: "user" as const,
        user_id: userId,
      };

      if (mode === "edit") {
        const { error: upErr } = await supabase
          .from("recipes")
          .update({
            title: recipeRow.title,
            cook_minutes: recipeRow.cook_minutes,
            difficulty: recipeRow.difficulty,
            dish_type: recipeRow.dish_type,
            base_servings: recipeRow.base_servings,
            steps: recipeRow.steps,
            image_url: recipeRow.image_url,
          })
          .eq("id", recipeId)
          .eq("user_id", userId);
        if (upErr) throw new Error(upErr.message);

        const { error: delErr } = await supabase
          .from("recipe_ingredients")
          .delete()
          .eq("recipe_id", recipeId);
        if (delErr) throw new Error(delErr.message);
      } else {
        const { error: insErr } = await supabase
          .from("recipes")
          .insert(recipeRow);
        if (insErr) throw new Error(insErr.message);
      }

      const { error: ingErr } = await supabase.from("recipe_ingredients").insert(
        ingRows.map((r) => ({
          recipe_id: recipeId,
          ingredient_name: r.ingredient_name,
          amount:
            r.amount != null && Number.isFinite(r.amount) ? r.amount : null,
          unit: r.unit,
          is_optional: false,
        })),
      );
      if (ingErr) throw new Error(ingErr.message);

      router.push(`/meal/${recipeId}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장에 실패했어요");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <header className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2.5 sm:px-5">
        <button
          type="button"
          onClick={() => router.back()}
          className="touch-target flex size-11 items-center justify-center rounded-full text-foreground transition-transform active:scale-95"
          aria-label="뒤로"
        >
          <ChevronLeft size={22} />
        </button>
        <h1 className="flex-1 text-[17px] font-bold text-foreground">
          {heading}
        </h1>
        <button
          type="button"
          disabled={!canSubmit || busy}
          onClick={() => void handleSave()}
          className="rounded-full bg-primary px-4 py-2 text-[13px] font-semibold text-primary-foreground shadow-[0_2px_8px_rgba(61,112,88,0.3)] transition-transform active:scale-95 disabled:opacity-40"
        >
          {busy ? "저장 중…" : "저장"}
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 pb-10 scrollbar-hide sm:px-6">
        {/* Photo */}
        <section className="mb-5">
          <p className="mb-2 text-[12px] font-semibold text-foreground">
            대표 사진
          </p>
          <div className="relative overflow-hidden rounded-2xl border border-border bg-muted">
            {previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewUrl}
                alt="미리보기"
                className="aspect-[16/10] w-full object-cover"
              />
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex aspect-[16/10] w-full flex-col items-center justify-center gap-2 text-muted-foreground transition-colors hover:bg-muted/80"
              >
                <Camera size={28} aria-hidden />
                <span className="text-[13px] font-medium">
                  갤러리 / 카메라에서 선택
                </span>
              </button>
            )}
            {previewUrl && (
              <div className="absolute top-2 right-2 flex gap-1.5">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="rounded-full bg-card/90 px-3 py-1.5 text-[11px] font-semibold text-foreground shadow-sm backdrop-blur-sm"
                >
                  변경
                </button>
                <button
                  type="button"
                  onClick={clearImage}
                  className="flex size-8 items-center justify-center rounded-full bg-card/90 text-foreground shadow-sm backdrop-blur-sm"
                  aria-label="사진 제거"
                >
                  <X size={14} />
                </button>
              </div>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
          />
        </section>

        {/* Basics */}
        <section className="mb-5 space-y-3">
          <Field label="요리명">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: 우리집 김치찌개"
              className="w-full rounded-xl border border-border bg-card px-3.5 py-2.5 text-[14px] text-foreground outline-none focus:border-primary"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="조리시간 (분)">
              <input
                inputMode="numeric"
                value={cookMinutes}
                onChange={(e) => setCookMinutes(e.target.value)}
                placeholder="20"
                className="w-full rounded-xl border border-border bg-card px-3.5 py-2.5 text-[14px] text-foreground outline-none focus:border-primary"
              />
            </Field>
            <Field label="기준 인분">
              <input
                inputMode="numeric"
                value={baseServings}
                onChange={(e) => setBaseServings(e.target.value)}
                className="w-full rounded-xl border border-border bg-card px-3.5 py-2.5 text-[14px] text-foreground outline-none focus:border-primary"
              />
            </Field>
          </div>

          <Field label="난이도">
            <div className="flex gap-1.5">
              {DIFFICULTIES.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDifficulty(d)}
                  className={`flex-1 rounded-full border py-2 text-[12px] font-semibold transition-all ${
                    difficulty === d
                      ? "border-transparent bg-primary text-primary-foreground"
                      : "border-border bg-card text-muted-foreground"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </Field>

          <Field label="종류">
            <div className="flex gap-1.5">
              {DISH_TYPES.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDishType(d)}
                  className={`flex-1 rounded-full border py-2 text-[12px] font-semibold transition-all ${
                    dishType === d
                      ? "border-transparent bg-primary text-primary-foreground"
                      : "border-border bg-card text-muted-foreground"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </Field>
        </section>

        {/* Ingredients */}
        <section className="mb-5">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[12px] font-semibold text-foreground">재료</p>
            <button
              type="button"
              onClick={() =>
                setIngredients((prev) => [
                  ...prev,
                  {
                    key: newKey(),
                    ingredient_name: "",
                    amount: "",
                    unit: "",
                  },
                ])
              }
              className="flex items-center gap-1 rounded-full border border-primary/25 bg-secondary px-2.5 py-1 text-[11px] font-bold text-primary"
            >
              <Plus size={12} />
              재료 추가
            </button>
          </div>
          <div className="space-y-2">
            {ingredients.map((row) => (
              <div
                key={row.key}
                className="grid grid-cols-[1fr_4.5rem_4rem_2rem] items-center gap-1.5"
              >
                <input
                  value={row.ingredient_name}
                  onChange={(e) =>
                    updateIng(row.key, { ingredient_name: e.target.value })
                  }
                  placeholder="재료명"
                  className="rounded-xl border border-border bg-card px-2.5 py-2 text-[13px] text-foreground outline-none focus:border-primary"
                />
                <input
                  inputMode="decimal"
                  value={row.amount}
                  onChange={(e) =>
                    updateIng(row.key, { amount: e.target.value })
                  }
                  placeholder="수량"
                  className="rounded-xl border border-border bg-card px-2 py-2 text-[13px] text-foreground outline-none focus:border-primary"
                />
                <input
                  value={row.unit}
                  onChange={(e) => updateIng(row.key, { unit: e.target.value })}
                  placeholder="단위"
                  className="rounded-xl border border-border bg-card px-2 py-2 text-[13px] text-foreground outline-none focus:border-primary"
                />
                <button
                  type="button"
                  onClick={() => removeIng(row.key)}
                  className="flex size-8 items-center justify-center text-muted-foreground"
                  aria-label="재료 삭제"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Steps */}
        <section className="mb-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[12px] font-semibold text-foreground">조리 단계</p>
            <button
              type="button"
              onClick={() =>
                setSteps((prev) => [...prev, { key: newKey(), content: "" }])
              }
              className="flex items-center gap-1 rounded-full border border-primary/25 bg-secondary px-2.5 py-1 text-[11px] font-bold text-primary"
            >
              <Plus size={12} />
              단계 추가
            </button>
          </div>
          <div className="space-y-3">
            {steps.map((row, index) => (
              <div
                key={row.key}
                className="rounded-2xl border border-border bg-card p-3 shadow-[0_1px_4px_rgba(0,0,0,0.04)]"
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[12px] font-bold text-primary">
                    Step {index + 1}
                  </span>
                  <div className="flex items-center gap-0.5">
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => moveStep(index, -1)}
                      className="flex size-8 items-center justify-center rounded-lg text-muted-foreground disabled:opacity-30"
                      aria-label="위로"
                    >
                      <ChevronUp size={16} />
                    </button>
                    <button
                      type="button"
                      disabled={index === steps.length - 1}
                      onClick={() => moveStep(index, 1)}
                      className="flex size-8 items-center justify-center rounded-lg text-muted-foreground disabled:opacity-30"
                      aria-label="아래로"
                    >
                      <ChevronDown size={16} />
                    </button>
                    <button
                      type="button"
                      disabled={steps.length <= 1}
                      onClick={() =>
                        setSteps((prev) =>
                          prev.length <= 1
                            ? prev
                            : prev.filter((s) => s.key !== row.key),
                        )
                      }
                      className="flex size-8 items-center justify-center rounded-lg text-muted-foreground disabled:opacity-30"
                      aria-label="단계 삭제"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <textarea
                  value={row.content}
                  onChange={(e) =>
                    setSteps((prev) =>
                      prev.map((s) =>
                        s.key === row.key
                          ? { ...s, content: e.target.value }
                          : s,
                      ),
                    )
                  }
                  rows={3}
                  placeholder="이 단계에서 할 일을 적어 주세요"
                  className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2.5 text-[13px] leading-relaxed text-foreground outline-none focus:border-primary"
                />
              </div>
            ))}
          </div>
        </section>

        {error && (
          <p className="rounded-xl bg-[#fef0ed] px-3 py-2 text-[12px] font-medium text-[#c04d38]">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12px] font-semibold text-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}
