import { describe, expect, it } from "vitest";
import {
  formatBranchLabel,
  formatCustomerDocAddress,
  resolveDocBuyer,
  resolveDocSeller,
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

describe("resolveDocBuyer — สำเนาผู้ซื้อบนเอกสาร", () => {
  const live = {
    name: "คุณสมชาย (ชื่อใหม่)",
    company: "บริษัทเปลี่ยนชื่อแล้ว จำกัด",
    taxId: "9999999999999",
    branchNumber: "00002",
    phone: "0999999999",
    address: "ที่อยู่ปัจจุบัน",
    billingAddress: "ที่อยู่ออกบิลปัจจุบัน",
    billingProvince: "เชียงใหม่",
  };

  const snapshot = {
    buyerName: "คุณสมชาย",
    buyerCompany: "บริษัท สยามเท็กซ์ จำกัด",
    buyerTaxId: "0105551234567",
    buyerBranchNumber: "00000",
    buyerPhone: "021234567",
    buyerAddress: "99 อาคารเอ ถ.สาทรใต้",
    buyerSubDistrict: "ทุ่งมหาเมฆ",
    buyerDistrict: "สาทร",
    buyerProvince: "กรุงเทพมหานคร",
    buyerPostalCode: "10120",
  };

  it("ใบที่มีสำเนา = พิมพ์ตามสำเนาเสมอ แม้โปรไฟล์ลูกค้าเปลี่ยนไปหมดแล้ว", () => {
    expect(resolveDocBuyer(snapshot, live)).toEqual({
      name: "คุณสมชาย",
      company: "บริษัท สยามเท็กซ์ จำกัด",
      address: "99 อาคารเอ ถ.สาทรใต้\nทุ่งมหาเมฆ สาทร กรุงเทพมหานคร 10120",
      taxId: "0105551234567",
      branch: "สำนักงานใหญ่",
      phone: "021234567",
    });
  });

  it("ใบเก่าที่ยังไม่มีสำเนา = ถอยไปอ่านค่าสด (ต้องไม่พิมพ์ออกมาโล่ง)", () => {
    expect(resolveDocBuyer({}, live)).toEqual({
      name: "คุณสมชาย (ชื่อใหม่)",
      company: "บริษัทเปลี่ยนชื่อแล้ว จำกัด",
      address: "ที่อยู่ออกบิลปัจจุบัน\nเชียงใหม่",
      taxId: "9999999999999",
      branch: "สาขา 00002",
      phone: "0999999999",
    });
  });

  it("ห้ามผสมสำเนากับค่าสด — มีชื่อในสำเนาแล้วต้องใช้ทั้งชุด แม้ช่องอื่นว่าง", () => {
    const partial = resolveDocBuyer({ buyerName: "คุณสมชาย" }, live);
    expect(partial.name).toBe("คุณสมชาย");
    expect(partial.address).toBeNull();
    expect(partial.taxId).toBeNull();
    expect(partial.company).toBeNull();
  });
});

describe("resolveDocSeller — หัวกระดาษฝั่งเรา", () => {
  const live = {
    name: "ห้างหุ้นส่วนจำกัด อาณาจักร (ที่อยู่ใหม่)",
    address: "ที่อยู่ออฟฟิศใหม่",
    taxId: "0503550005470",
    branch: "สำนักงานใหญ่",
    phone: "0812345678",
    email: "new@anajak.local",
  };

  it("ย้ายออฟฟิศแล้วใบเก่าต้องยังพิมพ์ที่อยู่เดิม", () => {
    expect(
      resolveDocSeller(
        {
          sellerName: "ห้างหุ้นส่วนจำกัด อาณาจักร",
          sellerAddress: "39/12 หมู่ 8 เชียงใหม่ 50100",
          sellerTaxId: "0503550005470",
          sellerBranch: "สำนักงานใหญ่",
          sellerPhone: "0800000000",
          sellerEmail: "old@anajak.local",
        },
        live,
      ).address,
    ).toBe("39/12 หมู่ 8 เชียงใหม่ 50100");
  });

  it("ใบเก่าที่ไม่มีสำเนา ใช้ข้อมูลกิจการปัจจุบัน", () => {
    expect(resolveDocSeller({}, live)).toEqual(live);
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
