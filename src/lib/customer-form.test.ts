import { describe, expect, it } from "vitest";
import {
  buildCustomerCommunicationPayload,
  buildCustomerUpdatePayload,
  customerEditFormFromRecord,
  hasCorporateDetails,
  validateCustomerCommunicationForm,
  validateCustomerEditForm,
  type CustomerEditForm,
} from "./customer-form";

const baseForm: CustomerEditForm = {
  customerType: "INDIVIDUAL",
  name: " สมชาย ",
  company: " บริษัท เอ จำกัด ",
  phone: " 081-234-5678 ",
  lineId: " @somchai ",
  email: " sales@example.com ",
  address: " กรุงเทพฯ ",
  notes: " ลูกค้าประจำ ",
  segment: "REGULAR",
  taxId: " 0105555555555 ",
  branchNumber: " 00000 ",
  creditLimit: "50000",
  defaultPaymentTerms: "NET_30",
  billingAddress: " 99 ถนนสุขุมวิท ",
  billingSubDistrict: " คลองตัน ",
  billingDistrict: " คลองเตย ",
  billingProvince: " กรุงเทพฯ ",
  billingPostalCode: " 10110 ",
};

describe("customer edit form policy", () => {
  it("แปลง null และวงเงินจากข้อมูลลูกค้าเป็นค่าที่ controlled form ใช้ได้", () => {
    expect(
      customerEditFormFromRecord({
        customerType: "CORPORATE",
        name: "บริษัท เอ",
        company: null,
        phone: null,
        lineId: null,
        email: null,
        address: null,
        notes: null,
        segment: "VIP",
        taxId: null,
        branchNumber: null,
        creditLimit: 0,
        defaultPaymentTerms: null,
        billingAddress: null,
        billingSubDistrict: null,
        billingDistrict: null,
        billingProvince: null,
        billingPostalCode: null,
      })
    ).toMatchObject({
      customerType: "CORPORATE",
      name: "บริษัท เอ",
      company: "",
      phone: "",
      segment: "VIP",
      creditLimit: "0",
      defaultPaymentTerms: "",
      billingPostalCode: "",
    });
  });

  it("trim ข้อความ ล้าง nullable field ด้วย null และเก็บ 0 เป็นวงเงินจริง", () => {
    expect(
      buildCustomerUpdatePayload("customer-1", {
        ...baseForm,
        branchNumber: "  ",
        billingAddress: " ",
        creditLimit: "0",
        defaultPaymentTerms: "",
      }, true)
    ).toMatchObject({
      id: "customer-1",
      name: "สมชาย",
      company: "บริษัท เอ จำกัด",
      phone: "081-234-5678",
      notes: "ลูกค้าประจำ",
      branchNumber: null,
      billingAddress: null,
      creditLimit: 0,
      defaultPaymentTerms: null,
    });
  });

  it("ไม่ส่งวงเงินเลยเมื่อผู้ใช้ไม่มีสิทธิ์แก้ เพื่อไม่ชน server guard", () => {
    const payload = buildCustomerUpdatePayload("customer-1", baseForm, false);

    expect(payload).not.toHaveProperty("creditLimit");
  });

  it("ถือว่ามีข้อมูลนิติบุคคลค้างเมื่อค่าที่ server ยังนำไปใช้ไม่ว่าง", () => {
    const emptyIndividual = {
      ...baseForm,
      company: "",
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

    expect(hasCorporateDetails(emptyIndividual)).toBe(false);
    expect(hasCorporateDetails({ ...emptyIndividual, creditLimit: "0" })).toBe(true);
    expect(hasCorporateDetails({ ...emptyIndividual, taxId: " 0105 " })).toBe(true);
  });

  it("ตรวจ required ตามกติกาฟอร์มเดิมและกันวงเงินที่แปลงเป็นตัวเลขไม่ได้", () => {
    expect(
      validateCustomerEditForm({
        ...baseForm,
        customerType: "CORPORATE",
        name: " ",
        company: " ",
        taxId: " ",
        creditLimit: "abc",
      })
    ).toEqual({
      name: "กรุณากรอกชื่อลูกค้า",
      company: "กรุณากรอกชื่อบริษัท",
      taxId: "กรุณากรอกเลขผู้เสียภาษี",
      creditLimit: "วงเงินเครดิตต้องเป็นตัวเลข",
    });
  });
});

describe("customer communication form policy", () => {
  it("trim เนื้อหาและไม่ส่งหัวข้อว่าง", () => {
    expect(
      buildCustomerCommunicationPayload("customer-1", {
        channel: "LINE",
        subject: "  ",
        content: "  ลูกค้าขอเลื่อนส่งเป็นวันศุกร์  ",
      })
    ).toEqual({
      customerId: "customer-1",
      channel: "LINE",
      subject: undefined,
      content: "ลูกค้าขอเลื่อนส่งเป็นวันศุกร์",
    });
  });

  it("ไม่ให้ส่งบันทึกที่มีแต่ช่องว่าง", () => {
    expect(
      validateCustomerCommunicationForm({ channel: "PHONE", subject: "", content: "   " })
    ).toEqual({ content: "กรุณาสรุปสิ่งที่คุยกับลูกค้า" });
  });
});
