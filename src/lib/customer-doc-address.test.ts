import { describe, expect, it } from "vitest";
import {
  formatBranchLabel,
  formatCustomerDocAddress,
} from "./customer-doc-address";

const full = {
  address: "88/12 ม.4 บางพลี สมุทรปราการ 10540",
  billingAddress: "99 อาคารเอ ถ.สาทรใต้",
  billingSubDistrict: "ทุ่งมหาเมฆ",
  billingDistrict: "สาทร",
  billingProvince: "กรุงเทพมหานคร",
  billingPostalCode: "10120",
};

describe("formatCustomerDocAddress", () => {
  it("พิมพ์ที่อยู่ออกใบกำกับครบทุกช่อง — ตำบล/อำเภอ/จังหวัด/ไปรษณีย์ต้องไม่หาย (ม.86/4)", () => {
    expect(formatCustomerDocAddress(full)).toBe(
      "99 อาคารเอ ถ.สาทรใต้\nทุ่งมหาเมฆ สาทร กรุงเทพมหานคร 10120",
    );
  });

  it("ไม่มีที่อยู่ออกใบกำกับ → ถอยไปใช้ที่อยู่ผู้ติดต่อ (กติกาเดิมของทุกใบ)", () => {
    expect(
      formatCustomerDocAddress({ address: "88/12 ม.4 บางพลี", billingAddress: null }),
    ).toBe("88/12 ม.4 บางพลี");
  });

  it("กรอกแค่บรรทัดแรกของที่อยู่ออกใบกำกับ ก็ไม่ต้องมีบรรทัดที่สอง", () => {
    expect(formatCustomerDocAddress({ billingAddress: "99 อาคารเอ", address: "เก่า" })).toBe(
      "99 อาคารเอ",
    );
  });

  it("กรอกแต่ช่องย่อย (ลืมบรรทัดแรก) ข้อมูลต้องยังขึ้นกระดาษ ไม่ตกไปใช้ที่อยู่ผู้ติดต่อ", () => {
    expect(
      formatCustomerDocAddress({
        address: "ที่อยู่ผู้ติดต่อ",
        billingProvince: "ชลบุรี",
        billingPostalCode: "20000",
      }),
    ).toBe("ชลบุรี 20000");
  });

  it("ไม่มีที่อยู่เลยคืน null (ไม่วาดบรรทัดว่างบนเอกสาร)", () => {
    expect(formatCustomerDocAddress({})).toBeNull();
    expect(formatCustomerDocAddress({ address: "   ", billingAddress: "  " })).toBeNull();
    expect(formatCustomerDocAddress(null)).toBeNull();
  });
});

describe("formatBranchLabel", () => {
  it('"00000" คือสำนักงานใหญ่ ห้ามพิมพ์ว่า "สาขา 00000"', () => {
    expect(formatBranchLabel("00000")).toBe("สำนักงานใหญ่");
  });

  it("เลขสาขาอื่นพิมพ์ตามจริง", () => {
    expect(formatBranchLabel("00001")).toBe("สาขา 00001");
  });

  it("ไม่ได้กรอกสาขา = ไม่พิมพ์บรรทัดสาขา", () => {
    expect(formatBranchLabel(null)).toBeUndefined();
    expect(formatBranchLabel("  ")).toBeUndefined();
  });
});
