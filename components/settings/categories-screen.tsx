"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase";
import type { Category } from "@/types/database";
import { SwipeDeleteRow } from "@/components/settings/swipe-delete-row";
import { EmptyState } from "@/components/ui/empty-state";
import { Toast, useToast } from "@/components/ui/toast";

const EMOJI_OPTIONS = [
  "🥬",
  "🥩",
  "🐟",
  "🥛",
  "🥚",
  "🫘",
  "🍎",
  "🧀",
  "🍞",
  "🌶️",
  "🧊",
  "📦",
];

type CategoriesScreenProps = {
  userId: string;
  initialCategories: Category[];
};

export function CategoriesScreen({
  userId,
  initialCategories,
}: CategoriesScreenProps) {
  const router = useRouter();
  const [items, setItems] = useState(initialCategories);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftIcon, setDraftIcon] = useState(EMOJI_OPTIONS[0]);
  const [busy, setBusy] = useState(false);
  const { message, showToast } = useToast(2000);

  function notify(message: string) {
    showToast(message);
  }

  async function addCategory() {
    const name = draftName.trim();
    if (!name || busy) return;
    setBusy(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("categories")
      .insert({ user_id: userId, name, icon: draftIcon })
      .select("*")
      .single();

    if (error) {
      console.error("[categories] insert:", error.message);
      notify("추가에 실패했어요");
    } else if (data) {
      setItems((prev) => [...prev, data as Category]);
      setShowAdd(false);
      setDraftName("");
      setDraftIcon(EMOJI_OPTIONS[0]);
      router.refresh();
    }
    setBusy(false);
  }

  async function saveEdit(id: string) {
    const name = draftName.trim();
    if (!name || busy) return;
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("categories")
      .update({ name, icon: draftIcon })
      .eq("id", id);

    if (error) {
      console.error("[categories] update:", error.message);
      notify("수정에 실패했어요");
    } else {
      setItems((prev) =>
        prev.map((c) =>
          c.id === id ? { ...c, name, icon: draftIcon } : c,
        ),
      );
      setEditingId(null);
      router.refresh();
    }
    setBusy(false);
  }

  async function deleteCategory(id: string) {
    if (busy) return;
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) {
      console.error("[categories] delete:", error.message);
      notify("삭제에 실패했어요");
    } else {
      setItems((prev) => prev.filter((c) => c.id !== id));
      if (editingId === id) setEditingId(null);
      router.refresh();
    }
    setBusy(false);
  }

  function startEdit(item: Category) {
    setShowAdd(false);
    setEditingId(item.id);
    setDraftName(item.name);
    setDraftIcon(item.icon || EMOJI_OPTIONS[0]);
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center gap-2 px-4 pt-4 pb-3">
        <button
          type="button"
          onClick={() => router.push("/settings")}
          className="touch-target flex size-11 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-[0_1px_6px_rgba(0,0,0,0.06)]"
          aria-label="뒤로"
        >
          <ChevronLeft size={18} />
        </button>
        <h1 className="flex-1 text-[22px] font-bold leading-[27.5px] text-foreground">
          카테고리 편집
        </h1>
        <button
          type="button"
          onClick={() => {
            setEditingId(null);
            setDraftName("");
            setDraftIcon(EMOJI_OPTIONS[0]);
            setShowAdd(true);
          }}
          className="touch-target flex size-11 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_2px_8px_rgba(61,112,88,0.35)]"
          aria-label="카테고리 추가"
        >
          <Plus size={18} strokeWidth={2.5} />
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-5 pb-8 scrollbar-hide">
        <p className="mb-1 text-[11px] text-muted-foreground">
          이름을 탭해 수정 · 왼쪽으로 밀거나 길게 눌러 삭제
        </p>

        {items.length === 0 && !showAdd && (
          <EmptyState
            variant="section"
            className="rounded-2xl border border-dashed border-border bg-card/60"
            title="아직 카테고리가 없어요"
            description="오른쪽 위 + 로 채소·육류 등을 추가해 보세요"
          />
        )}

        {items.map((item) =>
          editingId === item.id ? (
            <EditCard
              key={item.id}
              title="카테고리 수정"
              name={draftName}
              icon={draftIcon}
              busy={busy}
              onNameChange={setDraftName}
              onIconChange={setDraftIcon}
              onCancel={() => setEditingId(null)}
              onSave={() => void saveEdit(item.id)}
            />
          ) : (
            <SwipeDeleteRow
              key={item.id}
              disabled={busy}
              onDelete={() => void deleteCategory(item.id)}
            >
              <button
                type="button"
                onClick={() => startEdit(item)}
                className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3.5 text-left shadow-[0_2px_6px_rgba(0,0,0,0.05)]"
              >
                <span className="flex size-10 items-center justify-center rounded-2xl bg-[#edf3ef] text-[20px]">
                  {item.icon || "📦"}
                </span>
                <span className="text-[14px] font-semibold text-foreground">
                  {item.name}
                </span>
              </button>
            </SwipeDeleteRow>
          ),
        )}

        {showAdd && (
          <EditCard
            title="새 카테고리"
            name={draftName}
            icon={draftIcon}
            busy={busy}
            onNameChange={setDraftName}
            onIconChange={setDraftIcon}
            onCancel={() => setShowAdd(false)}
            onSave={() => void addCategory()}
          />
        )}
      </div>

      <Toast message={message} />
    </div>
  );
}

function EditCard({
  title,
  name,
  icon,
  busy,
  onNameChange,
  onIconChange,
  onCancel,
  onSave,
}: {
  title: string;
  name: string;
  icon: string;
  busy: boolean;
  onNameChange: (v: string) => void;
  onIconChange: (v: string) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  return (
    <div className="rounded-2xl border border-primary/20 bg-card p-4 shadow-[0_2px_6px_rgba(0,0,0,0.05)]">
      <p className="mb-3 text-[11px] font-semibold tracking-[0.275px] text-primary uppercase">
        {title}
      </p>
      <input
        value={name}
        onChange={(e) => onNameChange(e.target.value)}
        placeholder="카테고리 이름"
        className="mb-3 w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-[14px] outline-none focus:border-primary"
        autoFocus
      />
      <p className="mb-2 text-[11px] text-muted-foreground">이모지</p>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {EMOJI_OPTIONS.map((e) => (
          <button
            key={e}
            type="button"
            onClick={() => onIconChange(e)}
            className={`flex size-9 items-center justify-center rounded-xl text-[18px] transition-colors ${
              icon === e
                ? "bg-secondary ring-2 ring-primary/30"
                : "bg-muted"
            }`}
          >
            {e}
          </button>
        ))}
      </div>
      <input
        value={icon}
        onChange={(e) => onIconChange(e.target.value.slice(0, 4))}
        placeholder="직접 입력"
        className="mb-3 w-full rounded-xl border border-border bg-background px-3.5 py-2 text-[13px] outline-none focus:border-primary"
      />
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl bg-muted py-2.5 text-[13px] font-semibold text-foreground"
        >
          취소
        </button>
        <button
          type="button"
          disabled={busy || !name.trim()}
          onClick={onSave}
          className="rounded-xl bg-primary py-2.5 text-[13px] font-semibold text-primary-foreground disabled:opacity-50"
        >
          저장
        </button>
      </div>
    </div>
  );
}
