import { useState, useCallback } from "react";
import type {
  OrderItemForm,
  OrderFeeForm,
  ReferenceImage,
} from "@/types/order-form";
import {
  EMPTY_PRINT,
  EMPTY_ADDON,
  EMPTY_ITEM,
  EMPTY_FEE,
  itemHasContent,
} from "@/types/order-form";
import {
  EMPTY_ORDER_HEADER,
  type OrderHeaderState,
  type OrderPriority,
} from "@/hooks/use-order-header-form";
import type { ShippingState } from "@/hooks/use-order-shipping";

export const ORDER_DRAFT_VERSION = 2 as const;
export const ORDER_DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const ORDER_DRAFT_DEBOUNCE_MS = 800;

const ORDER_DRAFT_KEY = `order-draft-v${ORDER_DRAFT_VERSION}`;
const LEGACY_DRAFT_KEYS = ["order-draft-items", "order-draft-header"] as const;

type DraftStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export interface OrderDraftData {
  header: OrderHeaderState;
  // เก็บ object ที่ picker เลือกไว้เพื่อคืนชื่อ/ประเภทลูกค้าทันทีหลัง refresh
  selectedCustomer: unknown | null;
  items: OrderItemForm[];
  fees: OrderFeeForm[];
  includeShipping: boolean;
  shipping: ShippingState;
  filledFromCustomerId: string | null;
  // preview เป็น data URL ขนาดใหญ่และเป็นข้อมูลซ้ำกับไฟล์บน storage — ห้ามเขียนลง localStorage
  referenceImages: Array<Omit<ReferenceImage, "preview">>;
}

export interface OrderDraftEnvelope {
  version: typeof ORDER_DRAFT_VERSION;
  updatedAt: number;
  data: OrderDraftData;
}

interface DraftStorageOptions {
  storage?: DraftStorage;
  now?: number;
}

const ORDER_PRIORITIES: readonly OrderPriority[] = ["LOW", "NORMAL", "HIGH", "URGENT"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function stringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function normalizeHeader(value: unknown): OrderHeaderState {
  const raw = isRecord(value) ? value : {};
  const priority = ORDER_PRIORITIES.includes(raw.priority as OrderPriority)
    ? (raw.priority as OrderPriority)
    : EMPTY_ORDER_HEADER.priority;
  return {
    customerId: stringValue(raw.customerId),
    channel: stringValue(raw.channel, EMPTY_ORDER_HEADER.channel),
    title: stringValue(raw.title),
    description: stringValue(raw.description),
    deadline: stringValue(raw.deadline),
    notes: stringValue(raw.notes),
    priority,
    paymentTerms: stringValue(raw.paymentTerms),
    poNumber: stringValue(raw.poNumber),
    externalOrderId: stringValue(raw.externalOrderId),
    taxRate: finiteNumber(raw.taxRate, EMPTY_ORDER_HEADER.taxRate),
    discount: finiteNumber(raw.discount, EMPTY_ORDER_HEADER.discount),
    platformFee: finiteNumber(raw.platformFee, EMPTY_ORDER_HEADER.platformFee),
  };
}

function normalizeItems(value: unknown): OrderItemForm[] {
  if (!Array.isArray(value) || value.length === 0) {
    return [structuredClone(EMPTY_ITEM)];
  }
  return value.map((valueItem) => {
    const item = isRecord(valueItem) ? valueItem : {};
    const prints = Array.isArray(item.prints)
      ? item.prints.filter(isRecord).map((print) => {
          // ไฟล์ถูกอัปโหลดก่อนใส่ designImageUrl แล้ว — data URL ใช้แค่ preview ระหว่าง session
          const persisted = { ...print };
          delete persisted.designImagePreview;
          return { ...EMPTY_PRINT, ...persisted } as OrderItemForm["prints"][number];
        })
      : [];
    return {
      ...structuredClone(EMPTY_ITEM),
      ...item,
      description: stringValue(item.description),
      notes: stringValue(item.notes),
      products: Array.isArray(item.products) ? item.products as OrderItemForm["products"] : [],
      prints,
      addons: Array.isArray(item.addons) ? item.addons as OrderItemForm["addons"] : [],
    };
  });
}

function normalizeFees(value: unknown): OrderFeeForm[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((fee) => ({
    feeType: stringValue(fee.feeType),
    name: stringValue(fee.name),
    amount: finiteNumber(fee.amount, 0),
  }));
}

function normalizeShipping(value: unknown): ShippingState {
  const raw = isRecord(value) ? value : {};
  return {
    recipientName: stringValue(raw.recipientName),
    phone: stringValue(raw.phone),
    address: stringValue(raw.address),
    subDistrict: stringValue(raw.subDistrict),
    district: stringValue(raw.district),
    province: stringValue(raw.province),
    postalCode: stringValue(raw.postalCode),
  };
}

export function referenceImagesForDraft(
  value: readonly ReferenceImage[],
): Array<Omit<ReferenceImage, "preview">> {
  return value
    .filter((image) => !!image.fileUrl && !!image.fileName)
    .map(({ fileUrl, fileName, fileSize, printPosition }) => ({
      fileUrl,
      fileName,
      ...(typeof fileSize === "number" && Number.isFinite(fileSize) ? { fileSize } : {}),
      ...(printPosition ? { printPosition } : {}),
    }));
}

function normalizeReferenceImages(value: unknown): Array<Omit<ReferenceImage, "preview">> {
  if (!Array.isArray(value)) return [];
  const images: ReferenceImage[] = value.filter(isRecord).map((image) => ({
    fileUrl: stringValue(image.fileUrl),
    fileName: stringValue(image.fileName),
    fileSize: typeof image.fileSize === "number" ? image.fileSize : undefined,
    printPosition: typeof image.printPosition === "string" ? image.printPosition : undefined,
  }));
  return referenceImagesForDraft(images);
}

export function normalizeOrderDraftData(value: unknown): OrderDraftData | null {
  if (!isRecord(value)) return null;
  return {
    header: normalizeHeader(value.header),
    selectedCustomer: isRecord(value.selectedCustomer) ? value.selectedCustomer : null,
    items: normalizeItems(value.items),
    fees: normalizeFees(value.fees),
    includeShipping: value.includeShipping === true,
    shipping: normalizeShipping(value.shipping),
    filledFromCustomerId:
      typeof value.filledFromCustomerId === "string" ? value.filledFromCustomerId : null,
    referenceImages: normalizeReferenceImages(value.referenceImages),
  };
}

export function orderDraftHasContent(draft: OrderDraftData): boolean {
  const headerChanged = (Object.keys(EMPTY_ORDER_HEADER) as Array<keyof OrderHeaderState>)
    .some((key) => draft.header[key] !== EMPTY_ORDER_HEADER[key]);
  const shippingChanged = Object.values(draft.shipping).some((value) => value.trim().length > 0);
  return (
    headerChanged ||
    draft.items.some(itemHasContent) ||
    draft.fees.some((fee) => !!(fee.feeType || fee.name || fee.amount)) ||
    draft.includeShipping ||
    shippingChanged ||
    draft.referenceImages.length > 0
  );
}

export function parseOrderDraft(raw: string, now = Date.now()): OrderDraftData | null {
  try {
    const envelope = JSON.parse(raw) as unknown;
    if (!isRecord(envelope)) return null;
    if (envelope.version !== ORDER_DRAFT_VERSION) return null;
    if (typeof envelope.updatedAt !== "number" || !Number.isFinite(envelope.updatedAt)) return null;
    if (now - envelope.updatedAt > ORDER_DRAFT_TTL_MS) return null;
    return normalizeOrderDraftData(envelope.data);
  } catch {
    return null;
  }
}

export function orderDraftStorageKey(draftScope?: string): string {
  const scope = draftScope?.trim();
  return scope ? `${ORDER_DRAFT_KEY}:${encodeURIComponent(scope)}` : ORDER_DRAFT_KEY;
}

function resolveStorage(storage?: DraftStorage): DraftStorage | null {
  if (storage) return storage;
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

export function loadOrderDraft(
  draftScope?: string,
  options: DraftStorageOptions = {},
): OrderDraftData | null {
  const storage = resolveStorage(options.storage);
  if (!storage) return null;
  const key = orderDraftStorageKey(draftScope);
  try {
    const raw = storage.getItem(key);
    // draft รุ่นเก่าไม่มี timestamp จึงพิสูจน์อายุไม่ได้ — ลบทิ้งแทนการต่ออายุของเก่าเงียบๆ
    if (!draftScope) LEGACY_DRAFT_KEYS.forEach((legacyKey) => storage.removeItem(legacyKey));
    if (!raw) return null;
    const draft = parseOrderDraft(raw, options.now ?? Date.now());
    if (!draft) storage.removeItem(key);
    return draft;
  } catch {
    return null;
  }
}

export function saveOrderDraft(
  draft: OrderDraftData,
  draftScope?: string,
  options: DraftStorageOptions = {},
): void {
  const storage = resolveStorage(options.storage);
  if (!storage) return;
  const key = orderDraftStorageKey(draftScope);
  try {
    const normalized = normalizeOrderDraftData(draft);
    if (!normalized || !orderDraftHasContent(normalized)) {
      storage.removeItem(key);
      return;
    }
    const envelope: OrderDraftEnvelope = {
      version: ORDER_DRAFT_VERSION,
      updatedAt: options.now ?? Date.now(),
      data: normalized,
    };
    storage.setItem(key, JSON.stringify(envelope));
  } catch {
    // storage full, private mode หรือข้อมูล serialize ไม่ได้ — ฟอร์มหลักยังทำงานต่อ
  }
}

/** callback ของ debounce อาจถูก queue ไว้ก่อน success/reset — เขียนได้เฉพาะ revision ล่าสุดที่ยังไม่ block */
export function saveOrderDraftIfCurrent(
  draft: OrderDraftData,
  draftScope: string | undefined,
  guard: {
    scheduledRevision: number;
    currentRevision: number;
    blocked: boolean;
  },
  options: DraftStorageOptions = {},
): boolean {
  if (guard.blocked || guard.scheduledRevision !== guard.currentRevision) return false;
  saveOrderDraft(draft, draftScope, options);
  return true;
}

export function clearOrderDraft(
  draftScope?: string,
  options: Pick<DraftStorageOptions, "storage"> = {},
): void {
  const storage = resolveStorage(options.storage);
  if (!storage) return;
  try {
    storage.removeItem(orderDraftStorageKey(draftScope));
    if (!draftScope) LEGACY_DRAFT_KEYS.forEach((legacyKey) => storage.removeItem(legacyKey));
  } catch {
    // localStorage อาจถูก browser ปิด — reset state ในหน้ายังต้องทำงานต่อ
  }
}

export function useOrderItemsForm(
  initialItems?: OrderItemForm[],
) {
  const [items, setItems] = useState<OrderItemForm[]>(() => {
    if (initialItems && initialItems.length > 0) return initialItems;
    return [structuredClone(EMPTY_ITEM)];
  });

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
    },
    [],
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
