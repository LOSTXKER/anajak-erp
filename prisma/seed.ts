// Seed = master data จริงเท่านั้น (idempotent — รันซ้ำได้ ไม่สร้างซ้ำ ไม่แตะข้อมูลธุรกรรม)
// ห้ามใส่ demo data (user ปลอม/ลูกค้า/ออเดอร์ตัวอย่าง) — เคยทำให้ DB ปนจนต้องล้างตอน P0.3
// bootstrap ผู้ใช้คนแรก: node --env-file=.env scripts/create-owner.ts <email> <password> [ชื่อ]
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ============================================================
// SERVICE CATALOG — รายการบริการมาตรฐานของโรงงาน (แก้ราคาจริงได้ใน Settings → Services)
// ============================================================
const catalogItems = [
  // ADDON
  { category: "ADDON", type: "NECK_LABEL", name: "ป้ายคอ Woven", defaultPrice: 5, pricingType: "PER_PIECE", sortOrder: 1 },
  { category: "ADDON", type: "NECK_LABEL", name: "ป้ายคอ Satin", defaultPrice: 3, pricingType: "PER_PIECE", sortOrder: 2 },
  { category: "ADDON", type: "SIZE_LABEL", name: "ป้ายไซส์", defaultPrice: 2, pricingType: "PER_PIECE", sortOrder: 3 },
  { category: "ADDON", type: "CARE_LABEL", name: "ป้ายดูแลรักษา (Care Label)", defaultPrice: 3, pricingType: "PER_PIECE", sortOrder: 4 },
  { category: "ADDON", type: "HANG_TAG", name: "Hang Tag กระดาษหนา", defaultPrice: 8, pricingType: "PER_PIECE", sortOrder: 5 },
  { category: "ADDON", type: "HANG_TAG", name: "Hang Tag กระดาษรีไซเคิล", defaultPrice: 10, pricingType: "PER_PIECE", sortOrder: 6 },
  { category: "ADDON", type: "POLY_BAG", name: "ถุงแพค OPP", defaultPrice: 3, pricingType: "PER_PIECE", sortOrder: 7 },
  { category: "ADDON", type: "POLY_BAG", name: "ถุงซิปรูด", defaultPrice: 5, pricingType: "PER_PIECE", sortOrder: 8 },
  { category: "ADDON", type: "STICKER", name: "สติ๊กเกอร์แบรนด์", defaultPrice: 2, pricingType: "PER_PIECE", sortOrder: 9 },
  { category: "ADDON", type: "BOX", name: "กล่องบรรจุภัณฑ์", defaultPrice: 25, pricingType: "PER_PIECE", sortOrder: 10 },
  // PRINT
  { category: "PRINT", type: "SILK_SCREEN", name: "Silk Screen 1 สี", defaultPrice: 15, pricingType: "PER_PIECE", sortOrder: 1 },
  { category: "PRINT", type: "SILK_SCREEN", name: "Silk Screen 2 สี", defaultPrice: 25, pricingType: "PER_PIECE", sortOrder: 2 },
  { category: "PRINT", type: "SILK_SCREEN", name: "Silk Screen 3 สี", defaultPrice: 35, pricingType: "PER_PIECE", sortOrder: 3 },
  { category: "PRINT", type: "SILK_SCREEN", name: "Silk Screen 4+ สี", defaultPrice: 45, pricingType: "PER_PIECE", sortOrder: 4 },
  { category: "PRINT", type: "DTG", name: "DTG พิมพ์ดิจิทัล", defaultPrice: 50, pricingType: "PER_PIECE", sortOrder: 5 },
  { category: "PRINT", type: "SUBLIMATION", name: "Sublimation", defaultPrice: 40, pricingType: "PER_PIECE", sortOrder: 6 },
  { category: "PRINT", type: "HEAT_TRANSFER", name: "Heat Transfer", defaultPrice: 30, pricingType: "PER_PIECE", sortOrder: 7 },
  { category: "PRINT", type: "EMBROIDERY", name: "ปักโลโก้ (ไม่เกิน 8cm)", defaultPrice: 25, pricingType: "PER_PIECE", sortOrder: 8 },
  { category: "PRINT", type: "EMBROIDERY", name: "ปักโลโก้ (8-15cm)", defaultPrice: 40, pricingType: "PER_PIECE", sortOrder: 9 },
  // FEE
  { category: "FEE", type: "DESIGN_FEE", name: "ค่าออกแบบ", defaultPrice: 1500, pricingType: "PER_ORDER", sortOrder: 1 },
  { category: "FEE", type: "DESIGN_FEE", name: "ค่าออกแบบ (งานซับซ้อน)", defaultPrice: 3000, pricingType: "PER_ORDER", sortOrder: 2 },
  { category: "FEE", type: "SCREEN_SETUP", name: "ค่าทำบล็อกสกรีน (ต่อบล็อก)", defaultPrice: 200, pricingType: "PER_ORDER", sortOrder: 3 },
  { category: "FEE", type: "SAMPLE_FEE", name: "ค่าทำตัวอย่าง", defaultPrice: 500, pricingType: "PER_ORDER", sortOrder: 4 },
  { category: "FEE", type: "RUSH_FEE", name: "ค่าเร่งด่วน", defaultPrice: 1000, pricingType: "PER_ORDER", sortOrder: 5 },
  { category: "FEE", type: "DELIVERY", name: "ค่าจัดส่ง", defaultPrice: 100, pricingType: "PER_ORDER", sortOrder: 6 },
];

// หมายเหตุ: PackagingOption/Pattern ไม่ seed — เป็น master data ที่ผู้ใช้จัดการเองใน UI
// (DB มีของจริงที่เบสตั้งไว้แล้ว seed ไปทับ/เบิ้ลจะพัง)

async function main() {
  console.log("🌱 Seeding master data (idempotent)...");

  // ServiceCatalog ไม่มี unique key ธรรมชาติ — เทียบด้วย (category, type, name):
  // มีแล้ว = อัปเดตเฉพาะ sortOrder/pricingType (ไม่ทับราคาที่ผู้ใช้แก้เอง) · ยังไม่มี = สร้าง
  let created = 0;
  let existing = 0;
  for (const item of catalogItems) {
    const found = await prisma.serviceCatalog.findFirst({
      where: { category: item.category, type: item.type, name: item.name },
    });
    if (found) {
      await prisma.serviceCatalog.update({
        where: { id: found.id },
        data: { pricingType: item.pricingType, sortOrder: item.sortOrder },
      });
      existing++;
    } else {
      await prisma.serviceCatalog.create({ data: item });
      created++;
    }
  }
  console.log(`✅ ServiceCatalog: สร้างใหม่ ${created} · มีอยู่แล้ว ${existing}`);

  console.log("🎉 Seed เสร็จ — ไม่มี demo data (ตามกติกา P0.3)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
