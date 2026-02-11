import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // ============================================================
  // USERS
  // ============================================================
  const owner = await prisma.user.upsert({
    where: { email: "owner@anajakprint.com" },
    update: {},
    create: {
      supabaseId: "owner-001",
      email: "owner@anajakprint.com",
      name: "สมชาย (เจ้าของ)",
      role: "OWNER",
    },
  });

  const manager = await prisma.user.upsert({
    where: { email: "manager@anajakprint.com" },
    update: {},
    create: {
      supabaseId: "manager-001",
      email: "manager@anajakprint.com",
      name: "สมหญิง (ผู้จัดการ)",
      role: "MANAGER",
    },
  });

  const sales = await prisma.user.upsert({
    where: { email: "sales@anajakprint.com" },
    update: {},
    create: {
      supabaseId: "sales-001",
      email: "sales@anajakprint.com",
      name: "มานี (ฝ่ายขาย)",
      role: "SALES",
    },
  });

  const designer = await prisma.user.upsert({
    where: { email: "designer@anajakprint.com" },
    update: {},
    create: {
      supabaseId: "designer-001",
      email: "designer@anajakprint.com",
      name: "ชูใจ (ดีไซเนอร์)",
      role: "DESIGNER",
    },
  });

  const production = await prisma.user.upsert({
    where: { email: "production@anajakprint.com" },
    update: {},
    create: {
      supabaseId: "production-001",
      email: "production@anajakprint.com",
      name: "วิชัย (ฝ่ายผลิต)",
      role: "PRODUCTION_STAFF",
    },
  });

  console.log("✅ Users seeded");

  // ============================================================
  // CUSTOMERS
  // ============================================================
  const customer1 = await prisma.customer.create({
    data: {
      name: "คุณธนพล จันทร์ศรี",
      company: "บริษัท ไบรท์ไอเดีย จำกัด",
      email: "thanapol@brightidea.co.th",
      phone: "081-234-5678",
      lineId: "thanapol_bright",
      address: "123 ถนนสุขุมวิท แขวงคลองตัน เขตวัฒนา กรุงเทพฯ 10110",
      segment: "VIP",
      totalOrders: 15,
      totalSpent: 285000,
      tags: ["งานแบรนด์", "สั่งประจำ", "เสื้อยืด"],
    },
  });

  const customer2 = await prisma.customer.create({
    data: {
      name: "คุณอารยา วงศ์สวัสดิ์",
      company: "ร้าน Cat Lover Studio",
      email: "araya@catlover.com",
      phone: "089-876-5432",
      lineId: "araya_cat",
      segment: "REGULAR",
      totalOrders: 8,
      totalSpent: 42000,
      tags: ["Shopee", "ลายน่ารัก"],
    },
  });

  const customer3 = await prisma.customer.create({
    data: {
      name: "คุณพิชญ์ ตระกูลดี",
      phone: "062-111-2222",
      segment: "NEW",
      totalOrders: 1,
      totalSpent: 3500,
      tags: ["walk-in"],
    },
  });

  console.log("✅ Customers seeded");

  // ============================================================
  // BRAND PROFILES
  // ============================================================
  await prisma.brandProfile.create({
    data: {
      customerId: customer1.id,
      brandName: "Bright Idea Apparel",
      colorCodes: ["#1E40AF", "#FFFFFF", "#111827"],
      fonts: ["Prompt", "Inter"],
      styleNotes: "โทนสีน้ำเงินเข้ม-ขาว สไตล์ minimal professional",
    },
  });

  console.log("✅ Brand profiles seeded");

  // ============================================================
  // SERVICE CATALOG
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

  for (const item of catalogItems) {
    await prisma.serviceCatalog.create({ data: item });
  }

  console.log("✅ Service catalog seeded (" + catalogItems.length + " items)");

  // ============================================================
  // PRODUCTS (READY_MADE)
  // ============================================================
  const product1 = await prisma.product.create({
    data: {
      sku: "TS-MIDNIGHT-CAT",
      name: 'เสื้อยืดลาย "Midnight Cat"',
      description: "เสื้อยืดคอกลม Cotton 100% พิมพ์ลายแมวดำ สไตล์มินิมอล",
      productType: "T_SHIRT",
      category: "Animal Collection",
      basePrice: 350,
      costPrice: 120,
      source: "STOCK",
      stockProductId: "seed-stock-product-1",
      itemType: "FINISHED_GOOD",
      lastSyncAt: new Date(),
      variants: {
        create: [
          { size: "S", color: "Black", sku: "TS-MIDNIGHT-CAT-S-BLK", stock: 15, stockVariantId: "seed-sv-1" },
          { size: "M", color: "Black", sku: "TS-MIDNIGHT-CAT-M-BLK", stock: 25, stockVariantId: "seed-sv-2" },
          { size: "L", color: "Black", sku: "TS-MIDNIGHT-CAT-L-BLK", stock: 20, stockVariantId: "seed-sv-3" },
          { size: "XL", color: "Black", sku: "TS-MIDNIGHT-CAT-XL-BLK", stock: 10, stockVariantId: "seed-sv-4" },
          { size: "S", color: "White", sku: "TS-MIDNIGHT-CAT-S-WHT", stock: 10, stockVariantId: "seed-sv-5" },
          { size: "M", color: "White", sku: "TS-MIDNIGHT-CAT-M-WHT", stock: 20, stockVariantId: "seed-sv-6" },
          { size: "L", color: "White", sku: "TS-MIDNIGHT-CAT-L-WHT", stock: 15, stockVariantId: "seed-sv-7" },
          { size: "XL", color: "White", sku: "TS-MIDNIGHT-CAT-XL-WHT", stock: 5, stockVariantId: "seed-sv-8" },
        ],
      },
    },
  });

  await prisma.product.create({
    data: {
      sku: "TS-SUMMER-VIBE",
      name: 'เสื้อยืดลาย "Summer Vibe"',
      description: "เสื้อยืดคอกลม Cotton 100% พิมพ์ลายกราฟิกสีสดใส",
      productType: "T_SHIRT",
      category: "Seasonal",
      basePrice: 390,
      costPrice: 130,
      source: "STOCK",
      stockProductId: "seed-stock-product-2",
      itemType: "FINISHED_GOOD",
      lastSyncAt: new Date(),
      variants: {
        create: [
          { size: "M", color: "White", sku: "TS-SUMMER-VIBE-M-WHT", stock: 30, stockVariantId: "seed-sv-9" },
          { size: "L", color: "White", sku: "TS-SUMMER-VIBE-L-WHT", stock: 25, stockVariantId: "seed-sv-10" },
          { size: "XL", color: "White", sku: "TS-SUMMER-VIBE-XL-WHT", stock: 15, stockVariantId: "seed-sv-11" },
          { size: "M", color: "Cream", sku: "TS-SUMMER-VIBE-M-CRM", stock: 20, stockVariantId: "seed-sv-12" },
          { size: "L", color: "Cream", sku: "TS-SUMMER-VIBE-L-CRM", stock: 15, stockVariantId: "seed-sv-13" },
        ],
      },
    },
  });

  await prisma.product.create({
    data: {
      sku: "TB-LOGO-ECO",
      name: "ถุงผ้า Eco Tote",
      description: "ถุงผ้าแคนวาส 12oz พิมพ์ลายโลโก้",
      productType: "TOTE_BAG",
      category: "Eco",
      basePrice: 180,
      costPrice: 60,
      source: "STOCK",
      stockProductId: "seed-stock-product-3",
      itemType: "FINISHED_GOOD",
      lastSyncAt: new Date(),
      variants: {
        create: [
          { size: "FREE", color: "Natural", sku: "TB-LOGO-ECO-F-NAT", stock: 50, stockVariantId: "seed-sv-14" },
          { size: "FREE", color: "Black", sku: "TB-LOGO-ECO-F-BLK", stock: 30, stockVariantId: "seed-sv-15" },
        ],
      },
    },
  });

  console.log("✅ Products seeded");

  // ============================================================
  // VENDORS
  // ============================================================
  await prisma.vendor.create({
    data: {
      name: "ร้านปักดีไซน์",
      contactName: "คุณณัฐ",
      phone: "084-555-6789",
      capabilities: ["EMBROIDERY"],
      qualityRating: 4.5,
      timeRating: 4.0,
      priceRating: 3.5,
    },
  });

  await prisma.vendor.create({
    data: {
      name: "โรงพิมพ์สุขสวัสดิ์",
      contactName: "คุณเอก",
      phone: "085-111-2233",
      capabilities: ["SPECIAL_PRINT", "PATTERN_MAKING"],
      qualityRating: 4.0,
      timeRating: 3.5,
      priceRating: 4.0,
    },
  });

  console.log("✅ Vendors seeded");

  // ============================================================
  // SAMPLE ORDERS
  // ============================================================

  // Order 1: CUSTOM order via LINE (full custom)
  await prisma.order.create({
    data: {
      orderNumber: "ORD-2602-0001",
      orderType: "CUSTOM",
      channel: "LINE",
      customerId: customer1.id,
      createdById: sales.id,
      customerStatus: "IN_PRODUCTION",
      internalStatus: "PRODUCING",
      title: "เสื้อยืดทีม Bright Idea 2026",
      description: "เสื้อยืดคอกลม Cotton 100% สกรีนโลโก้หน้า-หลัง พร้อมป้ายคอ+แท็ก",
      deadline: new Date("2026-03-15"),
      subtotalItems: 11970,
      subtotalFees: 2800,
      discount: 0,
      totalAmount: 14770,
      items: {
        create: [
          {
            sortOrder: 0,
            productType: "T_SHIRT",
            description: "เสื้อยืดคอกลม Cotton 100% สีขาว",
            material: "Cotton 100% 20s",
            baseUnitPrice: 80,
            totalQuantity: 70,
            subtotal: 11970,
            variants: {
              create: [
                { size: "S", color: "White", quantity: 10 },
                { size: "M", color: "White", quantity: 30 },
                { size: "L", color: "White", quantity: 20 },
                { size: "XL", color: "White", quantity: 10 },
              ],
            },
            prints: {
              create: [
                { position: "FRONT", printType: "SILK_SCREEN", colorCount: 4, unitPrice: 45 },
                { position: "BACK", printType: "SILK_SCREEN", colorCount: 2, unitPrice: 30 },
              ],
            },
            addons: {
              create: [
                { addonType: "NECK_LABEL", name: "ป้ายคอ Woven", pricingType: "PER_PIECE", unitPrice: 5 },
                { addonType: "HANG_TAG", name: "Hang Tag กระดาษหนา", pricingType: "PER_PIECE", unitPrice: 8 },
                { addonType: "POLY_BAG", name: "ถุงแพค OPP", pricingType: "PER_PIECE", unitPrice: 3 },
              ],
            },
          },
        ],
      },
      fees: {
        create: [
          { feeType: "DESIGN_FEE", name: "ค่าออกแบบ", amount: 2000 },
          { feeType: "SCREEN_SETUP", name: "ค่าทำบล็อกสกรีน 4 บล็อก", amount: 800 },
        ],
      },
    },
  });

  // Order 2: READY_MADE order from Shopee
  await prisma.order.create({
    data: {
      orderNumber: "ORD-2602-0002",
      orderType: "READY_MADE",
      channel: "SHOPEE",
      customerId: customer2.id,
      createdById: sales.id,
      customerStatus: "READY_TO_SHIP",
      internalStatus: "READY_TO_SHIP",
      title: 'เสื้อยืดลาย "Midnight Cat" - Shopee',
      externalOrderId: "2502120001234",
      platformFee: 21,
      subtotalItems: 350,
      subtotalFees: 0,
      discount: 0,
      totalAmount: 350,
      items: {
        create: [
          {
            sortOrder: 0,
            productType: "T_SHIRT",
            description: 'เสื้อยืดลาย "Midnight Cat" สีดำ',
            baseUnitPrice: 350,
            totalQuantity: 1,
            subtotal: 350,
            variants: {
              create: [{ size: "L", color: "Black", quantity: 1 }],
            },
          },
        ],
      },
    },
  });

  // Order 3: CUSTOM from walk-in
  await prisma.order.create({
    data: {
      orderNumber: "ORD-2602-0003",
      orderType: "CUSTOM",
      channel: "WALK_IN",
      customerId: customer3.id,
      createdById: sales.id,
      customerStatus: "ORDER_RECEIVED",
      internalStatus: "INQUIRY",
      title: "เสื้อยืดงานเลี้ยงรุ่น",
      description: "ลูกค้า walk-in ต้องการเสื้อยืดงานเลี้ยงรุ่น 30 ปี",
      subtotalItems: 3500,
      subtotalFees: 0,
      discount: 0,
      totalAmount: 3500,
      items: {
        create: [
          {
            sortOrder: 0,
            productType: "T_SHIRT",
            description: "เสื้อยืดคอกลม งานเลี้ยงรุ่น 30 ปี",
            material: "Cotton 100%",
            baseUnitPrice: 100,
            totalQuantity: 25,
            subtotal: 3500,
            variants: {
              create: [
                { size: "M", color: "Navy", quantity: 8 },
                { size: "L", color: "Navy", quantity: 10 },
                { size: "XL", color: "Navy", quantity: 5 },
                { size: "2XL", color: "Navy", quantity: 2 },
              ],
            },
            prints: {
              create: [
                { position: "FRONT", printType: "DTG", unitPrice: 40 },
              ],
            },
          },
        ],
      },
    },
  });

  console.log("✅ Sample orders seeded");

  // ============================================================
  // SAMPLE NOTIFICATIONS
  // ============================================================
  await prisma.notification.createMany({
    data: [
      {
        userId: sales.id,
        type: "ORDER_STATUS",
        channel: "IN_APP",
        title: "ออเดอร์ ORD-2602-0001 เข้าสู่การผลิต",
        body: 'ออเดอร์ "เสื้อยืดทีม Bright Idea 2026" ถูกย้ายสถานะเป็น กำลังผลิต',
        sentAt: new Date(),
      },
      {
        userId: sales.id,
        type: "ORDER_STATUS",
        channel: "IN_APP",
        title: "ออเดอร์ ORD-2602-0002 พร้อมส่ง",
        body: 'ออเดอร์จาก Shopee "Midnight Cat" พร้อมจัดส่งแล้ว',
        sentAt: new Date(),
      },
      {
        userId: owner.id,
        type: "SYSTEM",
        channel: "IN_APP",
        title: "ยินดีต้อนรับสู่ Anajak Print ERP",
        body: "ระบบพร้อมใช้งานแล้ว เริ่มต้นด้วยการสร้างออเดอร์แรกของคุณ",
        sentAt: new Date(),
      },
    ],
  });

  console.log("✅ Notifications seeded");

  console.log("\n🎉 Seeding complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
