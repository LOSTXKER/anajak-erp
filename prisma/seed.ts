// Seed = master data จริงเท่านั้น (idempotent — รันซ้ำได้ ไม่สร้างซ้ำ ไม่แตะข้อมูลธุรกรรม)
// ห้ามใส่ demo data (user ปลอม/ลูกค้า/ออเดอร์ตัวอย่าง) — เคยทำให้ DB ปนจนต้องล้างตอน P0.3
// bootstrap ผู้ใช้คนแรก: node --env-file=.env scripts/create-owner.ts <email> <password> [ชื่อ]
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// จุดทำงานมาตรฐานของ Production V2 — เป็น master data เท่านั้น ไม่มีตัวเลข
// กำลังผลิตสมมติ ค่า capacity จึงคงเป็น NULL จนหัวหน้าประเมินจากงานจริง
const workCenters = [
  { code: "PREP", name: "เตรียมงาน", sortOrder: 10 },
  { code: "DTF_PRINT", name: "พิมพ์ DTF", sortOrder: 20 },
  { code: "HEAT_PRESS", name: "รีดร้อน", sortOrder: 30 },
  // ตรวจของที่กลับจากร้านนอกก่อนเข้าสายเรา (เบสสั่ง 2026-09-01: "ตรวจของกลับจากร้านด้วย")
  // เจอของเสียตั้งแต่แรก ไม่ใช่ไปเจอตอนรีดฟรีเสร็จแล้ว
  { code: "RETURN_QC", name: "ตรวจของกลับจากร้าน", sortOrder: 35 },
  { code: "FINAL_QC", name: "ตรวจคุณภาพขั้นสุดท้าย", sortOrder: 40 },
  { code: "FINAL_PACK", name: "แพ็กขั้นสุดท้าย", sortOrder: 50 },
  { code: "OUTSOURCE", name: "งานส่งผลิตภายนอก", sortOrder: 60 },
] as const;

/* ============================================================
   สูตรขั้นงานมาตรฐานของ Anajak (เบสตอบคำถามไว้ 2026-09-01)

   ① งานร้านนอก **ขนานกับ DTF ได้** — ฟิล์มพิมพ์รอไว้ก่อนได้ ระหว่างเสื้ออยู่ที่ร้าน
   ② เสื้อมาได้ 3 ทาง: เบิกสต๊อก · ลูกค้าส่งมา · สั่งตัดเย็บใหม่
   ③ ตรวจ QC 2 จุด: ของกลับจากร้าน + ท้ายงาน

   **สูตรเดียวที่มีครบทุกขั้น แล้วตอนเปิดใบงานค่อยตัดขั้นที่งานนั้นไม่ใช้ออก**
   (ไม่แยกสูตรตามเทคนิค เพราะ 3 ทางเสื้อ × 4 เทคนิค = 12 สูตรที่ต้องดูแล และงานผสม
   เช่น "ปัก + DTF ใบเดียว" ไม่เข้าสูตรไหนเลย)

   ⚠️ RoutingVersion ที่ RELEASED แล้วแก้ไม่ได้ (immutable ตามสัญญา V2) —
   seed นี้จึง "สร้างถ้ายังไม่มี" เท่านั้น ไม่เขียนทับของเดิม · จะแก้สูตร = ออกเวอร์ชันใหม่
   ============================================================ */

const STANDARD_ROUTING_CODE = "ANAJAK_STANDARD";

/** [รหัสขั้น, ชื่อ, ลำดับ, ช่วงงาน, รหัสศูนย์งาน, ส่งร้านนอกไหม] */
const standardOperations = [
  ["PREP_PICK", "เบิกเสื้อจากสต๊อก", 10, "PREPARATION", "PREP", false],
  ["PREP_RECEIVE", "รับเสื้อจากลูกค้า", 20, "PREPARATION", "PREP", false],
  ["CUTSEW", "สั่งตัดเย็บใหม่", 30, "OUTSOURCE", "OUTSOURCE", true],
  ["OUTSOURCE_WORK", "งานร้านนอก (ปัก/สกรีน/DTG/ป้ายคอ)", 40, "OUTSOURCE", "OUTSOURCE", true],
  ["RETURN_QC", "ตรวจของกลับจากร้าน", 50, "QUALITY", "RETURN_QC", false],
  ["DTF_PRINT", "พิมพ์ฟิล์ม DTF", 60, "MANUFACTURING", "DTF_PRINT", false],
  ["HEAT_PRESS", "รีดร้อน", 70, "MANUFACTURING", "HEAT_PRESS", false],
  ["FINAL_QC", "ตรวจคุณภาพขั้นสุดท้าย", 80, "QUALITY", "FINAL_QC", false],
  ["FINAL_PACK", "แพ็ก", 90, "PACKING", "FINAL_PACK", false],
] as const;

/** [ขั้นที่ต้องเสร็จก่อน, ขั้นที่รออยู่] — นี่คือสิ่งที่แทนกฎเดิม "รองานร้านนอกทุกสาย" */
const standardDependencies = [
  // เสื้อต้องพร้อมก่อนส่งไปร้าน (ตัดเย็บใหม่ก็ต้องเสร็จก่อนเอาไปปัก/สกรีน)
  ["PREP_PICK", "OUTSOURCE_WORK"],
  ["PREP_RECEIVE", "OUTSOURCE_WORK"],
  ["CUTSEW", "OUTSOURCE_WORK"],
  // ของกลับจากร้านต้องผ่านตรวจก่อนเข้าสายเรา
  ["OUTSOURCE_WORK", "RETURN_QC"],
  // รีดร้อนรอสามทาง: เสื้อพร้อม · ของกลับจากร้านผ่านตรวจ · ฟิล์มพิมพ์เสร็จ
  // (งานที่ไม่มีขั้นร้านนอกในใบ ขั้นนั้นถูกตัดออกตั้งแต่เปิดใบ เงื่อนไขจึงไม่ค้าง)
  ["PREP_PICK", "HEAT_PRESS"],
  ["PREP_RECEIVE", "HEAT_PRESS"],
  ["RETURN_QC", "HEAT_PRESS"],
  ["DTF_PRINT", "HEAT_PRESS"],
  ["HEAT_PRESS", "FINAL_QC"],
  ["FINAL_QC", "FINAL_PACK"],
] as const;

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

/**
 * สร้างสูตรขั้นงานมาตรฐาน — ทำครั้งเดียว ถ้ามีแล้วไม่แตะ
 * (RoutingVersion ที่ RELEASED เป็น immutable ตามสัญญาของ Production V2)
 */
async function seedStandardRouting() {
  const existing = await prisma.routing.findUnique({
    where: { code: STANDARD_ROUTING_CODE },
    include: { versions: { select: { id: true, state: true, versionNumber: true } } },
  });
  if (existing) {
    const released = existing.versions.filter((v) => v.state === "RELEASED").length;
    console.log(
      `✅ สูตรขั้นงานมาตรฐาน: มีอยู่แล้ว (${existing.versions.length} เวอร์ชัน · ใช้งานจริง ${released}) — ไม่แตะของเดิม`,
    );
    return;
  }

  const centers = await prisma.workCenter.findMany({ select: { id: true, code: true } });
  const centerId = new Map(centers.map((center) => [center.code, center.id]));

  await prisma.$transaction(async (tx) => {
    const routing = await tx.routing.create({
      data: {
        code: STANDARD_ROUTING_CODE,
        name: "งานสกรีนมาตรฐาน Anajak",
        description:
          "สูตรกลางที่มีครบทุกขั้น — ตอนเปิดใบงานให้ตัดขั้นที่งานนั้นไม่ใช้ออก · งานร้านนอกเดินขนานกับ DTF ได้ และของกลับจากร้านต้องผ่านตรวจก่อนรีด",
      },
    });
    const version = await tx.routingVersion.create({
      data: { routingId: routing.id, versionNumber: 1 },
    });

    const operationId = new Map<string, string>();
    for (const [code, name, sequence, phase, center, isOutsource] of standardOperations) {
      const operation = await tx.routingOperation.create({
        data: {
          routingVersionId: version.id,
          operationCode: code,
          name,
          sequence,
          phase,
          executionMode: isOutsource ? "OUTSOURCE" : "IN_HOUSE",
          workCenterId: centerId.get(center) ?? null,
          instructions: { text: `${name} ตามใบงานและภาพที่อนุมัติ` },
        },
      });
      operationId.set(code, operation.id);
    }

    await tx.routingOperationDependency.createMany({
      data: standardDependencies.map(([before, after]) => ({
        predecessorOperationId: operationId.get(before)!,
        successorOperationId: operationId.get(after)!,
      })),
    });

    await tx.routingVersion.update({
      where: { id: version.id },
      data: { state: "RELEASED", releasedAt: new Date() },
    });
  });

  console.log(
    `✅ สูตรขั้นงานมาตรฐาน: สร้างใหม่ ${standardOperations.length} ขั้น · ${standardDependencies.length} เส้น "ต้องเสร็จก่อน"`,
  );
}

async function main() {
  console.log("🌱 Seeding master data (idempotent)...");

  for (const center of workCenters) {
    await prisma.workCenter.upsert({
      where: { code: center.code },
      create: center,
      update: {
        name: center.name,
        sortOrder: center.sortOrder,
        isActive: true,
      },
    });
  }
  console.log("✅ Work Centers: อัปเดต master data แล้ว (ไม่เดากำลังผลิต)");

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

  await seedStandardRouting();

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
