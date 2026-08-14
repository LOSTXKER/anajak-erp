import type { InternalStatus } from "@prisma/client";
import type { inferRouterInputs } from "@trpc/server";
import type { PickerCustomer } from "@/components/customers/customer-picker";
import type { OrderHeaderState, OrderPriority } from "@/hooks/use-order-header-form";
import {
  EMPTY_SHIPPING_STATE,
  type ShippingState,
} from "@/hooks/use-order-shipping";
import type { RouterOutput } from "@/lib/trpc";
import type { AppRouter } from "@/server/routers/_app";
import {
  mapApiFeesToForm,
  mapApiItemsToForm,
  mapFeesToMutationInput,
  mapItemsToMutationInput,
} from "@/lib/order-mapping";
import {
  orderFeesFingerprint,
  orderItemsFingerprint,
  orderReferenceImagesFingerprint,
} from "@/lib/order-form-concurrency";
import { canIssueChangeOrder, isOrderLocked } from "@/lib/order-status";
import type {
  OrderFeeForm,
  OrderItemForm,
  ReferenceImage,
} from "@/types/order-form";
import { itemHasContent } from "@/types/order-form";

export type OrderEditOrder = RouterOutput["order"]["getById"];
export type OrderEditAttachment =
  RouterOutput["attachment"]["listByEntity"][number];
export type OrderEditActor = Pick<RouterOutput["user"]["me"], "id" | "role">;

export type OrderEditCapability = "direct" | "change_order" | "read_only";

/**
 * ไฟล์อ้างอิงในฟอร์มแก้มี identity จากฐานข้อมูลเพิ่มจากหน้า create
 * canEdit เป็นสิทธิ์ฝั่งจอเท่านั้น จึงไม่นำไปเทียบ dirty state
 */
export interface OrderEditReferenceImage extends ReferenceImage {
  /** ไฟล์เดิมมี id จาก Attachment; ไฟล์เพิ่งอัปโหลดใน shared form ยังไม่มีจนกว่าจะบันทึก */
  id?: string;
  canEdit: boolean;
}

export interface OrderEditFormValues {
  header: OrderHeaderState;
  items: OrderItemForm[];
  fees: OrderFeeForm[];
  includeShipping: boolean;
  shipping: ShippingState;
  referenceImages: OrderEditReferenceImage[];
}

type NormalizedItems = ReturnType<typeof mapItemsToMutationInput>;
type NormalizedFees = ReturnType<typeof mapFeesToMutationInput>;
type OrderSaveFormInput = inferRouterInputs<AppRouter>["order"]["saveForm"];

/** shape ตรงกับ order.saveForm เพื่อให้ UI ส่ง plan แต่ละก้อนได้โดยไม่ต้องแปลงซ้ำ */
export type OrderEditMutationMeta = NonNullable<OrderSaveFormInput["meta"]>;
export type OrderEditReferenceMutation = NonNullable<
  OrderSaveFormInput["referenceImages"]
>[number];

export interface OrderEditMetaSnapshot {
  /** customer/channel ถูกล็อกในหน้า edit และ server ไม่รับ จึงไม่นับเป็น dirty state */
  header: Omit<OrderHeaderState, "discount" | "customerId" | "channel">;
  includeShipping: boolean;
  shipping: ShippingState;
}

export interface OrderEditReferenceSnapshot {
  id: string;
  fileUrl: string;
  fileName: string;
  fileSize: number;
  printPosition: string;
}

export interface OrderEditFormSnapshot {
  meta: OrderEditMetaSnapshot;
  work: {
    items: NormalizedItems;
    fees: NormalizedFees;
    discount: number;
  };
  /** note บน placeholder ที่ไม่มี item content จะไม่ถูก map เข้า mutation แต่ต้องนับ dirty */
  residualItemNotes: string[];
  referenceImages: OrderEditReferenceSnapshot[];
}

export interface OrderEditFormSeed extends OrderEditFormValues {
  selectedCustomer: PickerCustomer;
  /** optimistic concurrency token — กันฟอร์มเก่าทับข้อมูลที่อีกหน้าจอบันทึกไปแล้ว */
  expectedUpdatedAt: Date;
  /** baseline ของแถวลูก — parent updatedAt ไม่ขยับจากงานตรวจรับ/ไฟล์ทุกทางเข้า */
  expectedItemsFingerprint: string;
  expectedFeesFingerprint: string;
  expectedReferenceImagesFingerprint: string;
  billedFloor: number;
  originalTotal: number;
  originalSnapshot: OrderEditFormSnapshot;
}

export interface OrderEditSavePlan {
  /** flat field-level diff ตรง saveForm — ห้ามพ่วง field เงินเดิมมากับการแก้ notes */
  meta?: OrderEditMutationMeta;
  /** แต่ละก้อนเป็น optional — ไม่ resubmit ข้อมูลเก่าที่ผู้ใช้ไม่ได้แตะ */
  work?: {
    items?: NormalizedItems;
    fees?: NormalizedFees;
    discount?: number;
  };
  /** รายการเป้าหมายหลังแก้ เรียง canonical แล้ว; undefined = ไฟล์ไม่เปลี่ยน */
  referenceImages?: OrderEditReferenceMutation[];
  headerChanged: boolean;
  shippingChanged: boolean;
  /** มี note บน empty item ที่ mutation จงใจไม่ส่ง — UI ต้องกันและพาไปเติมรายการจริง */
  hasResidualItemNotes?: true;
  hasChanges: boolean;
}

export type OrderEditBilledFloorState = "blocked" | "credit_note" | null;

/** mirror ด่าน B9 ฝั่ง server เพื่อเตือนก่อนกดบันทึก ไม่รอให้ mutation เด้งท้ายฟอร์ม */
export function getOrderEditBilledFloorState(params: {
  capability: OrderEditCapability;
  newTotal: number;
  billedFloor: number;
  originalTotal: number;
}): OrderEditBilledFloorState {
  const belowFloor =
    params.billedFloor > 0 &&
    params.newTotal < params.billedFloor - 0.005;
  if (!belowFloor) return null;
  if (params.capability === "change_order") return "credit_note";
  if (
    params.capability === "direct" &&
    params.newTotal < params.originalTotal - 0.005
  ) {
    return "blocked";
  }
  return null;
}

const ORDER_PRIORITIES: readonly OrderPriority[] = [
  "LOW",
  "NORMAL",
  "HIGH",
  "URGENT",
];

function finiteNumber(value: unknown, fallback = 0): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Object.is(value, -0) ? 0 : value;
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function trimmedString(value: unknown): string {
  return stringValue(value).trim();
}

/** Date จาก tRPC, ISO string และ null ต้องลง input[type=date] เป็นรูปเดียวกัน */
export function orderEditDateInputValue(
  value: Date | string | null | undefined,
): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function normalizedPriority(value: unknown): OrderPriority {
  return ORDER_PRIORITIES.includes(value as OrderPriority)
    ? (value as OrderPriority)
    : "NORMAL";
}

function hasShippingContent(shipping: ShippingState): boolean {
  return Object.values(shipping).some((value) => value.trim().length > 0);
}

function isImageAttachment(attachment: OrderEditAttachment): boolean {
  return (
    attachment.fileType.toLowerCase().startsWith("image/") ||
    /\.(?:avif|gif|jpe?g|png|webp)(?:\?.*)?$/i.test(attachment.fileUrl)
  );
}

export function canEditOrderReferenceImage(
  attachment: Pick<OrderEditAttachment, "uploadedById">,
  actor: OrderEditActor | null | undefined,
): boolean {
  if (!actor) return false;
  return (
    actor.role === "OWNER" ||
    actor.role === "MANAGER" ||
    attachment.uploadedById === actor.id
  );
}

function mapReferenceImages(
  attachments: OrderEditAttachment[],
  actor: OrderEditActor | null | undefined,
): OrderEditReferenceImage[] {
  return attachments
    .filter((attachment) => attachment.category === "REFERENCE_IMAGE")
    .map((attachment) => ({
      id: attachment.id,
      fileUrl: attachment.fileUrl,
      fileName: attachment.fileName,
      fileSize: attachment.fileSize,
      printPosition: attachment.printPosition ?? undefined,
      ...(isImageAttachment(attachment) ? { preview: attachment.fileUrl } : {}),
      canEdit: canEditOrderReferenceImage(attachment, actor),
    }));
}

/**
 * แปลงผล order.getById + attachment.listByEntity เป็น seed เดียวของ shared form
 * โดยไม่ใช้ default/effect ฝั่ง create เปลี่ยนค่าประวัติเดิมระหว่าง mount
 */
export function buildOrderEditFormSeed(
  order: OrderEditOrder,
  attachments: OrderEditAttachment[],
  actor: OrderEditActor | null | undefined,
): OrderEditFormSeed {
  const shipping: ShippingState = {
    recipientName: order.shippingRecipientName ?? "",
    phone: order.shippingPhone ?? "",
    address: order.shippingAddress ?? "",
    subDistrict: order.shippingSubDistrict ?? "",
    district: order.shippingDistrict ?? "",
    province: order.shippingProvince ?? "",
    postalCode: order.shippingPostalCode ?? "",
  };
  const items = mapApiItemsToForm(order.items);
  const fees = mapApiFeesToForm(order.fees);
  const header: OrderHeaderState = {
    customerId: order.customerId,
    channel: order.channel,
    title: order.title ?? "",
    description: order.description ?? "",
    deadline: orderEditDateInputValue(order.deadline),
    notes: order.notes ?? "",
    priority: normalizedPriority(order.priority),
    paymentTerms: order.paymentTerms ?? "",
    poNumber: order.poNumber ?? "",
    externalOrderId: order.externalOrderId ?? "",
    taxRate: finiteNumber(order.taxRate),
    discount: finiteNumber(order.discount),
    platformFee: finiteNumber(order.platformFee),
  };
  const values: OrderEditFormValues = {
    header,
    items,
    fees,
    includeShipping: hasShippingContent(shipping),
    shipping,
    referenceImages: mapReferenceImages(attachments, actor),
  };

  // customer.list เพิ่ม _count แต่ order.getById ไม่มี; totalOrders เป็นตัวเลขเดียวกันที่จอใช้
  const selectedCustomer: PickerCustomer = {
    ...order.customer,
    _count: { orders: order.customer.totalOrders },
  };

  return {
    ...values,
    selectedCustomer,
    expectedUpdatedAt: new Date(order.updatedAt),
    expectedItemsFingerprint: orderItemsFingerprint(order.items),
    expectedFeesFingerprint: orderFeesFingerprint(order.fees),
    expectedReferenceImagesFingerprint: orderReferenceImagesFingerprint(
      attachments.filter(
        (attachment) => attachment.category === "REFERENCE_IMAGE",
      ),
    ),
    billedFloor: finiteNumber(order.billedFloor),
    originalTotal: finiteNumber(order.totalAmount),
    originalSnapshot: buildOrderEditFormSnapshot(values),
  };
}

function jsonCanonical<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function normalizeMeta(values: OrderEditFormValues): OrderEditMetaSnapshot {
  const header = values.header;
  const includeShipping = Boolean(values.includeShipping);
  return {
    header: {
      title: trimmedString(header.title),
      // description/notes เก็บ whitespace ภายในตามที่ผู้ใช้พิมพ์ แต่ null/undefined เป็น ""
      description: stringValue(header.description),
      deadline: orderEditDateInputValue(header.deadline),
      notes: stringValue(header.notes),
      priority: normalizedPriority(header.priority),
      paymentTerms: trimmedString(header.paymentTerms),
      poNumber: trimmedString(header.poNumber),
      externalOrderId: trimmedString(header.externalOrderId),
      taxRate: finiteNumber(header.taxRate),
      platformFee: finiteNumber(header.platformFee),
    },
    includeShipping,
    // ปิดจัดส่ง = ช่องที่ซ่อนอยู่ไม่ควรทำ dirty ปลอม; includeShipping เป็นเจตนาล้างทั้งก้อน
    shipping: includeShipping
      ? {
          recipientName: trimmedString(values.shipping.recipientName),
          phone: trimmedString(values.shipping.phone),
          address: trimmedString(values.shipping.address),
          subDistrict: trimmedString(values.shipping.subDistrict),
          district: trimmedString(values.shipping.district),
          province: trimmedString(values.shipping.province),
          postalCode: trimmedString(values.shipping.postalCode),
        }
      : { ...EMPTY_SHIPPING_STATE },
  };
}

function normalizeReferenceImages(
  images: OrderEditReferenceImage[],
): OrderEditReferenceSnapshot[] {
  return images
    .map((image) => ({
      id: trimmedString(image.id ?? ""),
      fileUrl: trimmedString(image.fileUrl),
      fileName: stringValue(image.fileName),
      fileSize: finiteNumber(image.fileSize),
      printPosition: trimmedString(image.printPosition),
    }))
    .sort((a, b) =>
      `${a.id}\u0000${a.fileUrl}`.localeCompare(`${b.id}\u0000${b.fileUrl}`),
    );
}

function normalizeResidualItemNotes(items: OrderItemForm[]): string[] {
  return items.flatMap((item, index) => {
    if (itemHasContent(item)) return [];
    const note = trimmedString(item.notes);
    return note ? [`${index}\u0000${note}`] : [];
  });
}

export function buildOrderEditFormSnapshot(
  values: OrderEditFormValues,
): OrderEditFormSnapshot {
  return {
    meta: normalizeMeta(values),
    work: {
      // mutation mapping ตัด formKey/preview/display-only ออก จึงไม่ dirty จากรายละเอียดฝั่ง UI
      // useOrderItemsForm([]) เติม EMPTY_ITEM เพื่อให้จอมีการ์ดเริ่มต้น — placeholder ต้องไม่นับเป็นงาน
      items: jsonCanonical(
        mapItemsToMutationInput(values.items.filter(itemHasContent)),
      ),
      fees: jsonCanonical(mapFeesToMutationInput(values.fees)),
      discount: finiteNumber(values.header.discount),
    },
    residualItemNotes: normalizeResidualItemNotes(values.items),
    // attachment query เรียง createdAt desc ได้ไม่คงที่เมื่อ cache refetch — เทียบแบบ set ตาม id
    referenceImages: normalizeReferenceImages(values.referenceImages),
  };
}

function sameValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function nullableString(value: string): string | null {
  return value.length > 0 ? value : null;
}

function buildHeaderMutationDiff(
  original: OrderEditMetaSnapshot["header"],
  current: OrderEditMetaSnapshot["header"],
): OrderEditMutationMeta {
  const meta: OrderEditMutationMeta = {};
  if (original.title !== current.title) meta.title = current.title;
  if (original.description !== current.description) {
    meta.description = nullableString(current.description);
  }
  if (original.deadline !== current.deadline) {
    meta.deadline = nullableString(current.deadline);
  }
  if (original.notes !== current.notes) {
    meta.notes = nullableString(current.notes);
  }
  if (original.externalOrderId !== current.externalOrderId) {
    meta.externalOrderId = nullableString(current.externalOrderId);
  }
  if (original.platformFee !== current.platformFee) {
    meta.platformFee = current.platformFee;
  }
  if (original.priority !== current.priority) {
    meta.priority = current.priority;
  }
  if (original.paymentTerms !== current.paymentTerms) {
    meta.paymentTerms = nullableString(
      current.paymentTerms,
    ) as OrderEditMutationMeta["paymentTerms"];
  }
  if (original.poNumber !== current.poNumber) {
    meta.poNumber = nullableString(current.poNumber);
  }
  if (original.taxRate !== current.taxRate) meta.taxRate = current.taxRate;
  return meta;
}

function buildShippingMutationDiff(
  original: ShippingState,
  current: ShippingState,
): OrderEditMutationMeta {
  const meta: OrderEditMutationMeta = {};
  if (original.recipientName !== current.recipientName) {
    meta.shippingRecipientName = nullableString(current.recipientName);
  }
  if (original.phone !== current.phone) {
    meta.shippingPhone = nullableString(current.phone);
  }
  if (original.address !== current.address) {
    meta.shippingAddress = nullableString(current.address);
  }
  if (original.subDistrict !== current.subDistrict) {
    meta.shippingSubDistrict = nullableString(current.subDistrict);
  }
  if (original.district !== current.district) {
    meta.shippingDistrict = nullableString(current.district);
  }
  if (original.province !== current.province) {
    meta.shippingProvince = nullableString(current.province);
  }
  if (original.postalCode !== current.postalCode) {
    meta.shippingPostalCode = nullableString(current.postalCode);
  }
  return meta;
}

function toReferenceMutation(
  image: OrderEditReferenceSnapshot,
): OrderEditReferenceMutation {
  return {
    ...(image.id ? { id: image.id } : {}),
    fileUrl: image.fileUrl,
    fileName: image.fileName,
    fileSize: image.fileSize,
    ...(image.printPosition ? { printPosition: image.printPosition } : {}),
  };
}

/** สร้างแผนบันทึกจาก snapshot เดิม โดยไม่ส่งกลุ่มที่ไม่เปลี่ยน */
export function buildOrderEditSavePlan(
  original: OrderEditFormSnapshot,
  currentValues: OrderEditFormValues,
): OrderEditSavePlan {
  const current = buildOrderEditFormSnapshot(currentValues);
  const headerMeta = buildHeaderMutationDiff(
    original.meta.header,
    current.meta.header,
  );
  const shippingMeta = buildShippingMutationDiff(
    original.meta.shipping,
    current.meta.shipping,
  );
  const headerChanged = Object.keys(headerMeta).length > 0;
  const shippingChanged =
    original.meta.includeShipping !== current.meta.includeShipping ||
    Object.keys(shippingMeta).length > 0;
  const plan: OrderEditSavePlan = {
    headerChanged,
    shippingChanged,
    hasChanges: false,
  };

  const meta = { ...headerMeta, ...shippingMeta };
  if (Object.keys(meta).length > 0) {
    plan.meta = meta;
  }

  const work: NonNullable<OrderEditSavePlan["work"]> = {};
  if (!sameValue(original.work.items, current.work.items)) {
    work.items = current.work.items;
  }
  if (!sameValue(original.work.fees, current.work.fees)) {
    work.fees = current.work.fees;
  }
  if (original.work.discount !== current.work.discount) {
    work.discount = current.work.discount;
  }
  if (Object.keys(work).length > 0) {
    plan.work = work;
  }

  if (
    current.residualItemNotes.length > 0 &&
    !sameValue(original.residualItemNotes, current.residualItemNotes)
  ) {
    plan.hasResidualItemNotes = true;
  }

  if (!sameValue(original.referenceImages, current.referenceImages)) {
    plan.referenceImages = current.referenceImages.map(toReferenceMutation);
  }

  // includeShipping เป็น intent ฝั่ง UI; ตอนเปิดเป็นช่องว่าง plan ยัง dirty แต่ validation
  // shipping จะกันก่อนยิง server (server ไม่มี includeShipping field)
  plan.hasChanges = Boolean(
    headerChanged ||
      shippingChanged ||
      plan.work ||
      plan.referenceImages ||
      plan.hasResidualItemNotes,
  );
  return plan;
}

/**
 * งานแบบสอบถามยังไม่มี item จริง: fee/discount และ note บน placeholder ไม่มี parent
 * ให้ผูก จึงต้องค้างอยู่ในจอเป็น validation error แทนการส่ง items=[] หรือทิ้งเงียบ
 */
export function getOrderEditEmptyWorkResiduals(
  plan: OrderEditSavePlan,
  values: Pick<OrderEditFormValues, "items" | "fees"> & { discount: number },
): {
  itemNotes: boolean;
  feesWithoutItems: boolean;
  discountWithoutItems: boolean;
} {
  const hasContentItem = values.items.some(itemHasContent);

  return {
    itemNotes: Boolean(
      plan.hasResidualItemNotes &&
        values.items.some(
          (item) =>
            !itemHasContent(item) && trimmedString(item.notes).length > 0,
        ),
    ),
    feesWithoutItems: Boolean(
      !hasContentItem &&
        plan.work?.fees !== undefined &&
        values.fees.length > 0,
    ),
    discountWithoutItems: Boolean(
      !hasContentItem &&
        plan.work?.discount !== undefined &&
        finiteNumber(values.discount) > 0,
    ),
  };
}

/** capability นี้หมายถึงก้อน work (items/fees/discount); meta ยังแก้ตาม server contract เดิมได้ */
export function getOrderEditCapability(
  status: InternalStatus,
): OrderEditCapability {
  if (canIssueChangeOrder(status)) return "change_order";
  if (!isOrderLocked(status)) return "direct";
  return "read_only";
}

/** เหตุผล CO บังคับเฉพาะเมื่อแก้ work จริง ไม่บังคับตอนแก้ชื่อ/หมายเหตุ/ที่อยู่ล้วน */
export function requiresOrderEditReason(
  status: InternalStatus,
  plan: OrderEditSavePlan,
): boolean {
  return getOrderEditCapability(status) === "change_order" && Boolean(plan.work);
}
