import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Post-schema migration: cleanup and seed...\n");

  // Clean up orphaned variants (old order_item_id column was dropped)
  // Note: orderItemProductId is now required; orphans were cleaned up in prior run.
  // Keeping this as a no-op for documentation.
  console.log("Orphan cleanup: skipped (orderItemProductId is now required).");

  // Check order items with no products (they lost their product-level data)
  const emptyItems = await prisma.orderItem.findMany({
    where: { products: { none: {} } },
    select: { id: true, orderId: true },
  });
  if (emptyItems.length > 0) {
    console.log(
      `Found ${emptyItems.length} order items with no products (data was in dropped columns).`,
    );
    console.log("Creating placeholder products for each...");
    for (const item of emptyItems) {
      await prisma.orderItemProduct.create({
        data: {
          orderItemId: item.id,
          productType: "OTHER",
          description: "(ข้อมูลจาก migration - กรุณาแก้ไข)",
          baseUnitPrice: 0,
          totalQuantity: 0,
          subtotal: 0,
        },
      });
    }
  }

  // Seed packaging options
  const existingPkg = await prisma.packagingOption.count();
  if (existingPkg === 0) {
    console.log("\nSeeding packaging options...");
    await prisma.packagingOption.createMany({
      data: [
        { name: "ถุง OPP เล็ก", sortOrder: 0 },
        { name: "ถุง OPP ใหญ่", sortOrder: 1 },
        { name: "กล่อง", sortOrder: 2 },
        { name: "ซองไปรษณีย์", sortOrder: 3 },
        { name: "ไม่ต้องแพ็ค", sortOrder: 4 },
      ],
    });
    console.log("  Seeded 5 packaging options.");
  } else {
    console.log(`\nPackaging options already exist (${existingPkg}).`);
  }

  // Summary
  const stats = {
    orderItems: await prisma.orderItem.count(),
    products: await prisma.orderItemProduct.count(),
    variants: await prisma.orderItemVariant.count(),
    packaging: await prisma.packagingOption.count(),
  };
  console.log("\nMigration complete!");
  console.log(`  OrderItems: ${stats.orderItems}`);
  console.log(`  OrderItemProducts: ${stats.products}`);
  console.log(`  OrderItemVariants: ${stats.variants}`);
  console.log(`  PackagingOptions: ${stats.packaging}`);
}

main()
  .catch((e) => {
    console.error("Migration failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
