// ข้อมูลกิจการผู้ออกเอกสาร — หัวกระดาษทุกใบ + ข้อมูลบังคับของใบกำกับภาษีเต็มรูป (ม.86/4)
// เก็บเป็น JSON ใน Setting key เดียว · แก้ที่ Settings → ข้อมูลกิจการ (OWNER/MANAGER)

export const COMPANY_PROFILE_KEY = "company_profile";

export interface CompanyProfile {
  name: string; // ชื่อตามจดทะเบียน เช่น "บริษัท อณาจักร จำกัด"
  address: string;
  taxId: string; // เลขประจำตัวผู้เสียภาษี 13 หลัก
  branch: string; // "สำนักงานใหญ่" หรือ "สาขาที่ 00001"
  phone: string;
  email: string;
}

export const EMPTY_COMPANY_PROFILE: CompanyProfile = {
  name: "",
  address: "",
  taxId: "",
  branch: "สำนักงานใหญ่",
  phone: "",
  email: "",
};

export function parseCompanyProfile(raw: string | null | undefined): CompanyProfile {
  if (!raw) return EMPTY_COMPANY_PROFILE;
  try {
    return { ...EMPTY_COMPANY_PROFILE, ...(JSON.parse(raw) as Partial<CompanyProfile>) };
  } catch {
    // ค่าใน DB เพี้ยน — ใช้ค่าว่างให้หน้า settings กรอกใหม่ ดีกว่าพังทั้งหน้าพิมพ์
    return EMPTY_COMPANY_PROFILE;
  }
}
