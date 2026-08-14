"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ChevronDown, Search } from "lucide-react";
import type { RecipeMatch } from "@/lib/recipe-match";
import { CandidateCard } from "@/components/meal/candidate-card";
import { EmptyState } from "@/components/ui/empty-state";

type GroupFilter = "냉털" | "+1";

type SectionId = "메인요리" | "밑반찬" | "전체" | "내레시피";

type PlannerCandidatePanelProps = {
  matches: RecipeMatch[];
  draggingId: string | null;
  onDragBegin: (match: RecipeMatch, clientX: number, clientY: number) => void;
  onAdd: (match: RecipeMatch) => void;
};

function matchesTitle(m: RecipeMatch, q: string) {
  if (!q) return true;
  return m.recipe.title.toLowerCase().includes(q.toLowerCase());
}

export function PlannerCandidatePanel({
  matches,
  draggingId,
  onDragBegin,
  onAdd,
}: PlannerCandidatePanelProps) {
  const [open, setOpen] = useState<Record<SectionId, boolean>>({
    메인요리: false,
    밑반찬: false,
    전체: false,
    내레시피: false,
  });
  const [mainGroup, setMainGroup] = useState<GroupFilter>("냉털");
  const [sideGroup, setSideGroup] = useState<GroupFilter>("냉털");
  const [allQuery, setAllQuery] = useState("");
  const [mineQuery, setMineQuery] = useState("");

  function toggle(id: SectionId) {
    setOpen((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  const mains = useMemo(
    () => matches.filter((m) => m.recipe.dish_type === "메인요리"),
    [matches],
  );
  const sides = useMemo(
    () => matches.filter((m) => m.recipe.dish_type === "밑반찬"),
    [matches],
  );
  const mine = useMemo(
    () => matches.filter((m) => m.recipe.source === "user"),
    [matches],
  );

  const mainList = useMemo(
    () => mains.filter((m) => m.group === mainGroup),
    [mains, mainGroup],
  );
  const sideList = useMemo(
    () => sides.filter((m) => m.group === sideGroup),
    [sides, sideGroup],
  );
  const allList = useMemo(
    () => matches.filter((m) => matchesTitle(m, allQuery.trim())),
    [matches, allQuery],
  );
  const mineList = useMemo(
    () => mine.filter((m) => matchesTitle(m, mineQuery.trim())),
    [mine, mineQuery],
  );

  function renderGrid(list: RecipeMatch[], emptyTitle: string) {
    if (list.length === 0) {
      return (
        <EmptyState variant="section" className="py-2" title={emptyTitle} />
      );
    }
    return (
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {list.map((m) => (
          <CandidateCard
            key={m.recipe.id}
            match={m}
            dragging={draggingId === m.recipe.id}
            onDragBegin={onDragBegin}
            onAdd={() => onAdd(m)}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      <AccordionSection
        title="메인요리"
        count={mains.length}
        open={open.메인요리}
        onToggle={() => toggle("메인요리")}
      >
        <GroupChips value={mainGroup} onChange={setMainGroup} />
        {renderGrid(
          mainList,
          mainGroup === "냉털"
            ? "지금 바로 만들 수 있는 메인요리가 없어요"
            : "+1 재료면 가능한 메인요리가 없어요",
        )}
      </AccordionSection>

      <AccordionSection
        title="밑반찬"
        count={sides.length}
        open={open.밑반찬}
        onToggle={() => toggle("밑반찬")}
      >
        <GroupChips value={sideGroup} onChange={setSideGroup} />
        {renderGrid(
          sideList,
          sideGroup === "냉털"
            ? "지금 바로 만들 수 있는 밑반찬이 없어요"
            : "+1 재료면 가능한 밑반찬이 없어요",
        )}
      </AccordionSection>

      <AccordionSection
        title="전체 보기"
        count={matches.length}
        open={open.전체}
        onToggle={() => toggle("전체")}
      >
        <SearchField
          value={allQuery}
          onChange={setAllQuery}
          placeholder="레시피명 검색 (예: 면, 고기)"
        />
        {renderGrid(
          allList,
          allQuery.trim()
            ? "검색 결과가 없어요"
            : "등록된 레시피가 없어요",
        )}
      </AccordionSection>

      <AccordionSection
        title="내 레시피"
        count={mine.length}
        open={open.내레시피}
        onToggle={() => toggle("내레시피")}
      >
        <SearchField
          value={mineQuery}
          onChange={setMineQuery}
          placeholder="내 레시피 검색"
        />
        {renderGrid(
          mineList,
          mineQuery.trim()
            ? "검색 결과가 없어요"
            : "작성한 레시피가 없어요",
        )}
      </AccordionSection>
    </div>
  );
}

function AccordionSection({
  title,
  count,
  open,
  onToggle,
  children,
}: {
  title: string;
  count: number;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3.5 py-3 text-left transition-colors active:bg-muted/50"
      >
        <span className="flex-1 text-[13px] font-bold text-foreground">
          {title}
        </span>
        <span className="text-[11px] tabular-nums text-muted-foreground">
          {count}개
        </span>
        <ChevronDown
          size={16}
          className={`shrink-0 text-muted-foreground transition-transform ${
            open ? "rotate-180" : ""
          }`}
          aria-hidden
        />
      </button>
      {open && <div className="space-y-2.5 border-t border-border px-3 pb-3 pt-2.5">{children}</div>}
    </div>
  );
}

function GroupChips({
  value,
  onChange,
}: {
  value: GroupFilter;
  onChange: (v: GroupFilter) => void;
}) {
  const chips: { id: GroupFilter; label: string }[] = [
    { id: "냉털", label: "냉털 (바로 가능)" },
    { id: "+1", label: "재료 +1개" },
  ];
  return (
    <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
      {chips.map((chip) => (
        <button
          key={chip.id}
          type="button"
          onClick={() => onChange(chip.id)}
          className={`shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-medium transition-all ${
            value === chip.id
              ? "border-transparent bg-primary text-primary-foreground shadow-[0_2px_8px_rgba(61,112,88,0.25)]"
              : "border-border bg-background text-muted-foreground"
          }`}
        >
          {chip.label}
        </button>
      ))}
    </div>
  );
}

function SearchField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <label className="relative block">
      <Search
        size={14}
        className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-border bg-background py-2 pr-3 pl-8 text-[13px] text-foreground outline-none placeholder:text-muted-foreground focus:border-primary"
      />
    </label>
  );
}
