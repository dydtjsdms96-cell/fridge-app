"use client";

import { useCallback, useRef, useState } from "react";
import type { FridgeItem } from "@/types/database";
import type {
  DuplicateResolve,
  IncomingFridgeItem,
} from "@/lib/fridge-item-upsert";
import { DuplicateItemDialog } from "@/components/fridge/duplicate-item-dialog";

type PromptState = {
  existing: FridgeItem;
  incoming: IncomingFridgeItem;
  resolve: (choice: DuplicateResolve | "cancel") => void;
};

/** Promise 기반 중복 확인 다이얼로그. 저장 로직과 UI를 연결한다. */
export function useDuplicateItemPrompt() {
  const [prompt, setPrompt] = useState<PromptState | null>(null);
  const promptRef = useRef<PromptState | null>(null);

  const resolveDuplicate = useCallback(
    (existing: FridgeItem, incoming: IncomingFridgeItem) => {
      return new Promise<DuplicateResolve | "cancel">((resolve) => {
        const next = { existing, incoming, resolve };
        promptRef.current = next;
        setPrompt(next);
      });
    },
    [],
  );

  function finish(choice: DuplicateResolve | "cancel") {
    const current = promptRef.current;
    promptRef.current = null;
    setPrompt(null);
    current?.resolve(choice);
  }

  const dialog = prompt ? (
    <DuplicateItemDialog
      existing={prompt.existing}
      incoming={prompt.incoming}
      onMerge={() => finish("merge")}
      onSeparate={() => finish("separate")}
      onCancel={() => finish("cancel")}
    />
  ) : null;

  return { resolveDuplicate, dialog };
}
