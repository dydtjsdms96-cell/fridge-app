import type {
  FridgeInputMethod,
  FridgeItem,
  FridgeItemType,
  StorageZone,
} from "@/types/database";
import { createClient } from "@/lib/supabase";
import { ymdInAppTz } from "@/lib/dday";

export type IncomingFridgeItem = {
  name: string;
  quantity: number;
  unit: string | null;
  zone: StorageZone;
  sub_zone?: string | null;
  category?: string | null;
  expires_at: string | null;
  has_no_expiry: boolean;
  input_method?: FridgeInputMethod | null;
  /** 기본 원재료. 완성요리는 중복 합치기 없이 항상 별도 등록 */
  item_type?: FridgeItemType;
};

export type DuplicateResolve = "merge" | "separate";

export type SaveFridgeItemResult =
  | { status: "inserted"; item: FridgeItem }
  | { status: "merged"; item: FridgeItem };

export class SaveCancelledError extends Error {
  constructor() {
    super("SAVE_CANCELLED");
    this.name = "SaveCancelledError";
  }
}

/** 공백 제거 후 비교용 정규화 (매우 유사한 이름 = 공백만 다른 경우). */
export function normalizeItemName(name: string): string {
  return name.replace(/\s+/g, "").trim().toLowerCase();
}

export function namesMatch(a: string, b: string): boolean {
  return normalizeItemName(a) === normalizeItemName(b);
}

export function isCookedDish(
  item: Pick<FridgeItem, "item_type"> | Pick<IncomingFridgeItem, "item_type">,
): boolean {
  return item.item_type === "완성요리";
}

export function findDuplicateOwnedItem(
  ownedItems: FridgeItem[],
  incoming: Pick<IncomingFridgeItem, "name" | "zone" | "item_type">,
): FridgeItem | null {
  // 완성요리는 만든 시점이 다르면 다른 배치 → 합치지 않음
  if (isCookedDish(incoming)) return null;

  return (
    ownedItems.find(
      (item) =>
        item.status === "보유" &&
        !isCookedDish(item) &&
        item.zone === incoming.zone &&
        namesMatch(item.name, incoming.name),
    ) ?? null
  );
}

type ExpiryFields = {
  expires_at: string | null;
  has_no_expiry: boolean;
};

function isDated(item: ExpiryFields): item is {
  expires_at: string;
  has_no_expiry: false;
} {
  return !item.has_no_expiry && Boolean(item.expires_at);
}

/** 더 이른(가까운) 유통기한. 한쪽만 날짜면 날짜 쪽 우선. */
export function mergeExpiryFields(
  existing: ExpiryFields,
  incoming: ExpiryFields,
): ExpiryFields {
  const existingDated = isDated(existing);
  const incomingDated = isDated(incoming);

  if (existingDated && incomingDated) {
    const a = existing.expires_at.slice(0, 10);
    const b = incoming.expires_at.slice(0, 10);
    return {
      has_no_expiry: false,
      expires_at: a <= b ? a : b,
    };
  }
  if (existingDated) {
    return {
      has_no_expiry: false,
      expires_at: existing.expires_at.slice(0, 10),
    };
  }
  if (incomingDated) {
    return {
      has_no_expiry: false,
      expires_at: incoming.expires_at.slice(0, 10),
    };
  }
  // 둘 다 무기한이거나 날짜 미설정
  if (existing.has_no_expiry || incoming.has_no_expiry) {
    return { has_no_expiry: true, expires_at: null };
  }
  return { has_no_expiry: false, expires_at: null };
}

export function buildMergedUpdate(
  existing: FridgeItem,
  incoming: IncomingFridgeItem,
): {
  quantity: number;
  unit: string | null;
  category: string | null;
  sub_zone: string | null;
  expires_at: string | null;
  has_no_expiry: boolean;
} {
  const expiry = mergeExpiryFields(
    {
      expires_at: existing.expires_at,
      has_no_expiry: Boolean(existing.has_no_expiry),
    },
    {
      expires_at: incoming.has_no_expiry ? null : incoming.expires_at,
      has_no_expiry: incoming.has_no_expiry,
    },
  );

  return {
    quantity: Number(existing.quantity) + Number(incoming.quantity),
    unit: existing.unit ?? incoming.unit,
    category: existing.category ?? incoming.category ?? null,
    sub_zone: existing.sub_zone ?? incoming.sub_zone ?? null,
    expires_at: expiry.expires_at,
    has_no_expiry: expiry.has_no_expiry,
  };
}

type SupabaseClient = ReturnType<typeof createClient>;

export type SaveFridgeItemOptions = {
  supabase?: SupabaseClient;
  /** 로컬 캐시가 있으면 우선 사용 후, 없으면 DB에서 조회 */
  ownedItems?: FridgeItem[];
  /**
   * 중복이 있을 때 사용자 선택.
   * merge / separate 반환. 취소 시 SaveCancelledError throw 또는 "cancel" 반환.
   */
  resolveDuplicate: (
    existing: FridgeItem,
    incoming: IncomingFridgeItem,
  ) => Promise<DuplicateResolve | "cancel">;
};

async function fetchOwnedInZone(
  supabase: SupabaseClient,
  userId: string,
  zone: StorageZone,
): Promise<FridgeItem[]> {
  const { data, error } = await supabase
    .from("fridge_items")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "보유")
    .eq("zone", zone);

  if (error) throw new Error(error.message);
  return (data ?? []) as FridgeItem[];
}

/**
 * 수동 / 음성 / 바코드 등록 공용 저장.
 * 동일 이름(공백 무시)·동일 zone·보유 항목이 있으면 합치기/별도 등록을 물어본다.
 */
export async function saveFridgeItem(
  userId: string,
  incoming: IncomingFridgeItem,
  options: SaveFridgeItemOptions,
): Promise<SaveFridgeItemResult> {
  const supabase = options.supabase ?? createClient();
  const purchasedAt = ymdInAppTz();

  const pool =
    options.ownedItems?.filter(
      (i) => i.status === "보유" && i.zone === incoming.zone,
    ) ?? (await fetchOwnedInZone(supabase, userId, incoming.zone));

  const duplicate = findDuplicateOwnedItem(pool, incoming);

  if (duplicate) {
    const choice = await options.resolveDuplicate(duplicate, incoming);
    if (choice === "cancel") throw new SaveCancelledError();

    if (choice === "merge") {
      const patch = buildMergedUpdate(duplicate, incoming);
      const { data, error } = await supabase
        .from("fridge_items")
        .update(patch)
        .eq("id", duplicate.id)
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      return { status: "merged", item: data as FridgeItem };
    }
    // separate → fall through to insert
  }

  const { data, error } = await supabase
    .from("fridge_items")
    .insert({
      user_id: userId,
      name: incoming.name.trim(),
      quantity: incoming.quantity,
      unit: incoming.unit,
      zone: incoming.zone,
      sub_zone: incoming.sub_zone ?? null,
      category: incoming.category ?? null,
      expires_at: incoming.has_no_expiry ? null : incoming.expires_at,
      has_no_expiry: incoming.has_no_expiry,
      status: "보유",
      item_type: incoming.item_type ?? "원재료",
      input_method: incoming.input_method ?? null,
      purchased_at: purchasedAt,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return { status: "inserted", item: data as FridgeItem };
}

/**
 * 여러 건 순차 저장 (음성 등). 각 건마다 중복 확인.
 * 로컬 목록을 갱신하며 이어지는 중복 탐지에 반영한다.
 */
export async function saveFridgeItems(
  userId: string,
  incomings: IncomingFridgeItem[],
  options: SaveFridgeItemOptions,
): Promise<SaveFridgeItemResult[]> {
  const supabase = options.supabase ?? createClient();
  let owned =
    options.ownedItems?.filter((i) => i.status === "보유") ??
    (
      await supabase
        .from("fridge_items")
        .select("*")
        .eq("user_id", userId)
        .eq("status", "보유")
    ).data ??
    [];

  const results: SaveFridgeItemResult[] = [];

  for (const incoming of incomings) {
    const result = await saveFridgeItem(userId, incoming, {
      ...options,
      supabase,
      ownedItems: owned as FridgeItem[],
    });
    results.push(result);

    if (result.status === "merged") {
      owned = (owned as FridgeItem[]).map((item) =>
        item.id === result.item.id ? result.item : item,
      );
    } else {
      owned = [result.item, ...(owned as FridgeItem[])];
    }
  }

  return results;
}
