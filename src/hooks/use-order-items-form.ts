import { useState, useCallback, useEffect, useRef } from "react";
import type { OrderItemForm, OrderFeeForm } from "@/types/order-form";
import {
  EMPTY_PRINT,
  EMPTY_ADDON,
  EMPTY_ITEM,
  EMPTY_FEE,
} from "@/types/order-form";

const DRAFT_KEY = "order-draft-items";
const FULL_DRAFT_KEY = "order-full-draft";
const DRAFT_DEBOUNCE_MS = 800;

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
    const hasContent = items.some(
      (it) =>
        it.description ||
        it.products.some(
          (p) => p.description || p.productId || p.variants.some((v) => v.size),
        ),
    );
    if (hasContent) {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(items));
    }
  } catch {
    // storage full or unavailable
  }
}

export function clearDraft() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(DRAFT_KEY);
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

export interface OrderDraftData {
  channel?: string;
  customerId?: string;
  title?: string;
  description?: string;
  deadline?: string;
  notes?: string;
  orderType?: string;
  customMode?: string;
  priority?: string;
  paymentTerms?: string;
  poNumber?: string;
  taxRate?: number;
  discount?: number;
  platformFee?: number;
  externalOrderId?: string;
  showShipping?: boolean;
  shippingRecipientName?: string;
  shippingPhone?: string;
  shippingAddress?: string;
  shippingSubDistrict?: string;
  shippingDistrict?: string;
  shippingProvince?: string;
  shippingPostalCode?: string;
}

function loadFullDraft(): OrderDraftData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(FULL_DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as OrderDraftData;
  } catch {
    return null;
  }
}

function saveFullDraft(data: OrderDraftData) {
  if (typeof window === "undefined") return;
  try {
    const hasContent = Object.values(data).some(
      (v) => v !== undefined && v !== null && v !== "",
    );
    if (hasContent) {
      localStorage.setItem(FULL_DRAFT_KEY, JSON.stringify(data));
    }
  } catch {
    // storage full or unavailable
  }
}

export function clearFullDraft() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(FULL_DRAFT_KEY);
}

export function useOrderDraft() {
  const [draftData, setDraftData] = useState<OrderDraftData | null>(
    () => loadFullDraft(),
  );
  const [hasFullDraft, setHasFullDraft] = useState(() => !!loadFullDraft());

  const draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const saveFullDraftDebounced = useCallback((data: OrderDraftData) => {
    setDraftData(data);
  }, []);

  useEffect(() => {
    if (!draftData) return;
    if (draftTimer.current) clearTimeout(draftTimer.current);
    draftTimer.current = setTimeout(() => saveFullDraft(draftData), DRAFT_DEBOUNCE_MS);
    return () => {
      if (draftTimer.current) clearTimeout(draftTimer.current);
    };
  }, [draftData]);

  const loadDraftData = useCallback((): OrderDraftData | null => {
    return loadFullDraft();
  }, []);

  const clearDraftData = useCallback(() => {
    clearFullDraft();
    setDraftData(null);
    setHasFullDraft(false);
  }, []);

  return {
    draftData,
    hasFullDraft,
    saveFullDraft: saveFullDraftDebounced,
    loadFullDraft: loadDraftData,
    clearFullDraft: clearDraftData,
  };
}

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
