import { useState, useCallback, useEffect, useRef } from "react";
import type { OrderItemForm, OrderFeeForm } from "@/types/order-form";
import {
  EMPTY_PRINT,
  EMPTY_ADDON,
  EMPTY_ITEM,
  EMPTY_FEE,
  itemHasContent,
} from "@/types/order-form";

const DRAFT_KEY = "order-draft-items";
const HEADER_DRAFT_KEY = "order-draft-header";
const DRAFT_DEBOUNCE_MS = 800;

// หัวฟอร์มเปิดงาน (ลูกค้า/ชื่องาน/รายละเอียดจากแชท) ก็ต้องรอด refresh เหมือนรายการ —
// เดิม draft เก็บแค่ items ลูกค้าที่เลือก+ข้อความจากแชทหายหมด (audit ข้อ 6)
export type OrderHeaderDraft = {
  customerId?: string;
  // เก็บ object ลูกค้าที่เลือกทั้งก้อน (ข้อมูลจาก server) — restore picker ได้ทันที
  selectedCustomer?: unknown;
  title?: string;
  description?: string;
};

export function loadHeaderDraft(): OrderHeaderDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(HEADER_DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as OrderHeaderDraft;
  } catch {
    return null;
  }
}

export function saveHeaderDraft(draft: OrderHeaderDraft) {
  if (typeof window === "undefined") return;
  try {
    const hasContent = !!(draft.customerId || draft.title?.trim() || draft.description?.trim());
    if (hasContent) {
      localStorage.setItem(HEADER_DRAFT_KEY, JSON.stringify(draft));
    } else {
      localStorage.removeItem(HEADER_DRAFT_KEY);
    }
  } catch {
    // storage full or unavailable
  }
}

function loadDraft(): OrderItemForm[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map((item: Partial<OrderItemForm>) => ({
        ...structuredClone(EMPTY_ITEM),
        ...item,
      }));
    }
  } catch {
    // corrupted draft
  }
  return null;
}

function saveDraft(items: OrderItemForm[]) {
  if (typeof window === "undefined") return;
  try {
    // เกณฑ์เดียวกับ hasItemContent ของหน้าเปิดงาน — เนื้อหายหมด = ลบ draft ทิ้งด้วย
    // (เดิมเกณฑ์แคบกว่า + ไม่เคยลบ → ลบของในฟอร์มแล้ว draft เก่ายังเด้งกลับมา)
    if (items.some(itemHasContent)) {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(items));
    } else {
      localStorage.removeItem(DRAFT_KEY);
    }
  } catch {
    // storage full or unavailable
  }
}

export function clearDraft() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(DRAFT_KEY);
  localStorage.removeItem(HEADER_DRAFT_KEY);
}

export function useOrderItemsForm(
  initialItems?: OrderItemForm[],
  options?: { enableDraft?: boolean },
) {
  const enableDraft = options?.enableDraft ?? false;

  const [items, setItems] = useState<OrderItemForm[]>(() => {
    if (initialItems && initialItems.length > 0) return initialItems;
    if (enableDraft) {
      const draft = loadDraft();
      if (draft) return draft;
    }
    return [structuredClone(EMPTY_ITEM)];
  });

  const [hasDraft, setHasDraft] = useState(() => enableDraft && !!loadDraft());

  const draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!enableDraft) return;
    if (draftTimer.current) clearTimeout(draftTimer.current);
    draftTimer.current = setTimeout(() => saveDraft(items), DRAFT_DEBOUNCE_MS);
    return () => {
      if (draftTimer.current) clearTimeout(draftTimer.current);
    };
  }, [items, enableDraft]);

  const dismissDraft = useCallback(() => {
    clearDraft();
    setHasDraft(false);
    setItems([structuredClone(EMPTY_ITEM)]);
  }, []);

  const addItem = useCallback(
    () => setItems((prev) => [...prev, structuredClone(EMPTY_ITEM)]),
    [],
  );

  const removeItem = useCallback(
    (idx: number) => setItems((prev) => prev.filter((_, i) => i !== idx)),
    [],
  );

  const updateItem = useCallback(
    (idx: number, field: string, value: unknown) => {
      setItems((prev) => {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], [field]: value };
        return copy;
      });
    },
    [],
  );

  const addPrint = useCallback((itemIdx: number) => {
    setItems((prev) => {
      const copy = [...prev];
      copy[itemIdx] = {
        ...copy[itemIdx],
        prints: [...copy[itemIdx].prints, { ...EMPTY_PRINT }],
      };
      return copy;
    });
  }, []);

  const removePrint = useCallback((itemIdx: number, pIdx: number) => {
    setItems((prev) => {
      const copy = [...prev];
      copy[itemIdx] = {
        ...copy[itemIdx],
        prints: copy[itemIdx].prints.filter((_, i) => i !== pIdx),
      };
      return copy;
    });
  }, []);

  const updatePrint = useCallback(
    (itemIdx: number, pIdx: number, field: string, value: unknown) => {
      setItems((prev) => {
        const copy = [...prev];
        const prints = [...copy[itemIdx].prints];
        prints[pIdx] = { ...prints[pIdx], [field]: value };
        copy[itemIdx] = { ...copy[itemIdx], prints };
        return copy;
      });
    },
    [],
  );

  const addAddon = useCallback((itemIdx: number) => {
    setItems((prev) => {
      const copy = [...prev];
      copy[itemIdx] = {
        ...copy[itemIdx],
        addons: [...copy[itemIdx].addons, { ...EMPTY_ADDON }],
      };
      return copy;
    });
  }, []);

  const removeAddon = useCallback((itemIdx: number, aIdx: number) => {
    setItems((prev) => {
      const copy = [...prev];
      copy[itemIdx] = {
        ...copy[itemIdx],
        addons: copy[itemIdx].addons.filter((_, i) => i !== aIdx),
      };
      return copy;
    });
  }, []);

  const updateAddon = useCallback(
    (itemIdx: number, aIdx: number, field: string, value: unknown) => {
      setItems((prev) => {
        const copy = [...prev];
        const addons = [...copy[itemIdx].addons];
        addons[aIdx] = { ...addons[aIdx], [field]: value };
        copy[itemIdx] = { ...copy[itemIdx], addons };
        return copy;
      });
    },
    [],
  );

  const resetItems = useCallback(
    (newItems?: OrderItemForm[]) => {
      setItems(newItems ?? [structuredClone(EMPTY_ITEM)]);
      if (enableDraft) clearDraft();
    },
    [enableDraft],
  );

  return {
    items,
    setItems,
    addItem,
    removeItem,
    updateItem,
    addPrint,
    removePrint,
    updatePrint,
    addAddon,
    removeAddon,
    updateAddon,
    resetItems,
    hasDraft,
    dismissDraft,
  };
}

// useOrderDraft + OrderDraftData (full-form draft) ถูกลบตอน P0.5 — ไม่มีใครใช้
// draft ที่ใช้จริงคือระบบ DRAFT_KEY (เฉพาะ items) ใน useOrderItemsForm ข้างบน

export function useOrderFeesForm(initialFees?: OrderFeeForm[]) {
  const [fees, setFees] = useState<OrderFeeForm[]>(initialFees ?? []);

  const addFee = useCallback(
    () => setFees((prev) => [...prev, { ...EMPTY_FEE }]),
    [],
  );

  const removeFee = useCallback(
    (idx: number) => setFees((prev) => prev.filter((_, i) => i !== idx)),
    [],
  );

  const updateFee = useCallback(
    <K extends keyof OrderFeeForm>(idx: number, field: K, value: OrderFeeForm[K]) => {
      setFees((prev) => {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], [field]: value };
        return copy;
      });
    },
    [],
  );

  const resetFees = useCallback(
    (newFees?: OrderFeeForm[]) => setFees(newFees ?? []),
    [],
  );

  return { fees, setFees, addFee, removeFee, updateFee, resetFees };
}
