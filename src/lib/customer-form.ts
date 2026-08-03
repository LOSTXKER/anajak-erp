import type { PaymentTermsValue } from "./payment-terms";

export type CustomerTypeValue = "INDIVIDUAL" | "CORPORATE";
export type CustomerSegmentValue =
  | "VIP"
  | "REGULAR"
  | "NEW"
  | "INACTIVE"
  | "WHOLESALE"
  | "RETAIL";

export interface CustomerEditForm {
  customerType: CustomerTypeValue;
  name: string;
  company: string;
  phone: string;
  lineId: string;
  /** ชื่อ+ลิงก์ห้องแชทที่คุยกับลูกค้าจริง (เบสสั่ง 2026-07-31) */
  chatName: string;
  chatUrl: string;
  email: string;
  address: string;
  notes: string;
  segment: CustomerSegmentValue;
  taxId: string;
  branchNumber: string;
  creditLimit: string;
  defaultPaymentTerms: string;
  billingAddress: string;
  billingSubDistrict: string;
  billingDistrict: string;
  billingProvince: string;
  billingPostalCode: string;
}

export interface CustomerEditRecord {
  customerType: CustomerTypeValue;
  name: string;
  company: string | null;
  phone: string | null;
  lineId: string | null;
  chatName: string | null;
  chatUrl: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  segment: CustomerSegmentValue;
  taxId: string | null;
  branchNumber: string | null;
  creditLimit: number | null;
  defaultPaymentTerms: string | null;
  billingAddress: string | null;
  billingSubDistrict: string | null;
  billingDistrict: string | null;
  billingProvince: string | null;
  billingPostalCode: string | null;
}

export interface CustomerUpdatePayload {
  id: string;
  customerType: CustomerTypeValue;
  name: string;
  company: string;
  phone: string;
  lineId: string;
  /** ชื่อ+ลิงก์ห้องแชทที่คุยกับลูกค้าจริง (เบสสั่ง 2026-07-31) */
  chatName: string;
  chatUrl: string;
  email: string;
  address: string;
  notes: string;
  segment: CustomerSegmentValue;
  taxId: string;
  branchNumber: string | null;
  defaultPaymentTerms: PaymentTermsValue | null;
  billingAddress: string | null;
  billingSubDistrict: string | null;
  billingDistrict: string | null;
  billingProvince: string | null;
  billingPostalCode: string | null;
  creditLimit?: number | null;
}

/** payload ฝั่งสร้าง — ตรง input ของ customer.create (field ว่างไม่ส่ง = undefined) */
export interface CustomerCreatePayload {
  customerType: CustomerTypeValue;
  name: string;
  company?: string;
  phone?: string;
  lineId?: string;
  chatName?: string;
  chatUrl?: string;
  email?: string;
  address?: string;
  notes?: string;
  segment: CustomerSegmentValue;
  taxId?: string;
  branchNumber?: string;
  billingAddress?: string;
  billingSubDistrict?: string;
  billingDistrict?: string;
  billingProvince?: string;
  billingPostalCode?: string;
  creditLimit?: number;
  defaultPaymentTerms?: PaymentTermsValue;
}

export type CustomerEditErrors = Partial<
  Record<"name" | "company" | "taxId" | "creditLimit", string>
>;

export interface CustomerCommunicationForm {
  channel: string;
  subject: string;
  content: string;
}

export interface CustomerCommunicationPayload {
  customerId: string;
  channel: string;
  subject: string | undefined;
  content: string;
}

export function customerEditFormFromRecord(customer: CustomerEditRecord): CustomerEditForm {
  return {
    customerType: customer.customerType,
    name: customer.name,
    company: customer.company ?? "",
    phone: customer.phone ?? "",
    lineId: customer.lineId ?? "",
    chatName: customer.chatName ?? "",
    chatUrl: customer.chatUrl ?? "",
    email: customer.email ?? "",
    address: customer.address ?? "",
    notes: customer.notes ?? "",
    segment: customer.segment,
    taxId: customer.taxId ?? "",
    branchNumber: customer.branchNumber ?? "",
    creditLimit: customer.creditLimit != null ? String(customer.creditLimit) : "",
    defaultPaymentTerms: customer.defaultPaymentTerms ?? "",
    billingAddress: customer.billingAddress ?? "",
    billingSubDistrict: customer.billingSubDistrict ?? "",
    billingDistrict: customer.billingDistrict ?? "",
    billingProvince: customer.billingProvince ?? "",
    billingPostalCode: customer.billingPostalCode ?? "",
  };
}

/** ค่าตั้งต้นฟอร์มเพิ่มลูกค้า — segment "NEW" ตรง default ของ customer.create ฝั่ง server */
export function emptyCustomerForm(): CustomerEditForm {
  return {
    customerType: "INDIVIDUAL",
    name: "",
    company: "",
    phone: "",
    lineId: "",
    chatName: "",
    chatUrl: "",
    email: "",
    address: "",
    notes: "",
    segment: "NEW",
    taxId: "",
    branchNumber: "",
    creditLimit: "",
    defaultPaymentTerms: "",
    billingAddress: "",
    billingSubDistrict: "",
    billingDistrict: "",
    billingProvince: "",
    billingPostalCode: "",
  };
}

function nullableTrimmed(value: string): string | null {
  return value.trim() || null;
}

function undefinedTrimmed(value: string): string | undefined {
  return value.trim() || undefined;
}

/**
 * สร้าง payload ให้ตรง customer.create — field ว่างไม่ส่ง (undefined ต่างจาก update ที่ล้างด้วย null)
 * รวมกติกา "SALES ไม่ส่ง creditLimit เลย — ส่งไปโดน FORBIDDEN (ช่องก็ disabled แล้ว)"
 */
export function buildCustomerCreatePayload(
  form: CustomerEditForm,
  canSetCredit: boolean
): CustomerCreatePayload {
  return {
    customerType: form.customerType,
    name: form.name.trim(),
    company: undefinedTrimmed(form.company),
    phone: undefinedTrimmed(form.phone),
    lineId: undefinedTrimmed(form.lineId),
    chatName: undefinedTrimmed(form.chatName),
    chatUrl: undefinedTrimmed(form.chatUrl),
    email: undefinedTrimmed(form.email),
    address: undefinedTrimmed(form.address),
    notes: undefinedTrimmed(form.notes),
    segment: form.segment,
    taxId: undefinedTrimmed(form.taxId),
    branchNumber: undefinedTrimmed(form.branchNumber),
    billingAddress: undefinedTrimmed(form.billingAddress),
    billingSubDistrict: undefinedTrimmed(form.billingSubDistrict),
    billingDistrict: undefinedTrimmed(form.billingDistrict),
    billingProvince: undefinedTrimmed(form.billingProvince),
    billingPostalCode: undefinedTrimmed(form.billingPostalCode),
    ...(canSetCredit && form.creditLimit
      ? { creditLimit: Number.parseFloat(form.creditLimit) }
      : {}),
    ...(form.defaultPaymentTerms
      ? { defaultPaymentTerms: form.defaultPaymentTerms as PaymentTermsValue }
      : {}),
  };
}

/** สร้าง payload ให้ตรง customer.update รวมกติกา "ไม่มีสิทธิ์ = ไม่ส่งวงเงิน" */
export function buildCustomerUpdatePayload(
  customerId: string,
  form: CustomerEditForm,
  canEditCredit: boolean
): CustomerUpdatePayload {
  return {
    id: customerId,
    customerType: form.customerType,
    name: form.name.trim(),
    // string ว่างคงเป็น "" เพื่อรักษาพฤติกรรม API เดิม ส่วน field nullable ล้างด้วย null
    company: form.company.trim(),
    phone: form.phone.trim(),
    lineId: form.lineId.trim(),
    chatName: form.chatName.trim(),
    chatUrl: form.chatUrl.trim(),
    email: form.email.trim(),
    address: form.address.trim(),
    notes: form.notes.trim(),
    segment: form.segment,
    taxId: form.taxId.trim(),
    branchNumber: nullableTrimmed(form.branchNumber),
    defaultPaymentTerms: (form.defaultPaymentTerms || null) as PaymentTermsValue | null,
    billingAddress: nullableTrimmed(form.billingAddress),
    billingSubDistrict: nullableTrimmed(form.billingSubDistrict),
    billingDistrict: nullableTrimmed(form.billingDistrict),
    billingProvince: nullableTrimmed(form.billingProvince),
    billingPostalCode: nullableTrimmed(form.billingPostalCode),
    ...(canEditCredit
      ? { creditLimit: form.creditLimit ? Number.parseFloat(form.creditLimit) : null }
      : {}),
  };
}

/** ตรวจเฉพาะข้อบังคับที่ฟอร์มเดิมใช้ โดยไม่เพิ่มกติกาธุรกิจใหม่เหนือ server */
export function validateCustomerEditForm(form: CustomerEditForm): CustomerEditErrors {
  const errors: CustomerEditErrors = {};
  if (!form.name.trim()) errors.name = "กรุณากรอกชื่อลูกค้า";
  if (form.customerType === "CORPORATE" && !form.company.trim()) {
    errors.company = "กรุณากรอกชื่อบริษัท";
  }
  if (form.customerType === "CORPORATE" && !form.taxId.trim()) {
    errors.taxId = "กรุณากรอกเลขผู้เสียภาษี";
  }
  if (form.creditLimit && !Number.isFinite(Number.parseFloat(form.creditLimit))) {
    errors.creditLimit = "วงเงินเครดิตต้องเป็นตัวเลข";
  }
  return errors;
}

/** ข้อมูลที่ยังมีผลกับใบกำกับ/วงเงินจริง ต้องไม่ถูกซ่อนเมื่อสลับเป็นบุคคลธรรมดา */
export function hasCorporateDetails(form: CustomerEditForm): boolean {
  return Boolean(
    form.taxId.trim() ||
      form.branchNumber.trim() ||
      form.creditLimit ||
      form.defaultPaymentTerms ||
      form.billingAddress.trim() ||
      form.billingSubDistrict.trim() ||
      form.billingDistrict.trim() ||
      form.billingProvince.trim() ||
      form.billingPostalCode.trim()
  );
}

export function validateCustomerCommunicationForm(
  form: CustomerCommunicationForm
): Partial<Record<"content", string>> {
  return form.content.trim()
    ? {}
    : { content: "กรุณาสรุปสิ่งที่คุยกับลูกค้า" };
}

export function buildCustomerCommunicationPayload(
  customerId: string,
  form: CustomerCommunicationForm
): CustomerCommunicationPayload {
  return {
    customerId,
    channel: form.channel,
    subject: form.subject.trim() || undefined,
    content: form.content.trim(),
  };
}
