/**
 * Seed Script: Add Default Addon Types
 * สร้าง Addon Types เริ่มต้น (ถุง, ป้าย, พับแพค)
 */

import prisma from '../src/lib/prisma'

async function main() {
  console.log('🌱 Starting Addon Types Seed...\n')

  const addonTypes = [
    // Packaging (บรรจุภัณฑ์)
    {
      code: 'BAG-OPP',
      name: 'OPP Bag',
      nameTh: 'ถุง OPP ใส',
      category: 'packaging',
      basePrice: 2.0,
      priceType: 'per_piece',
      requiresDesign: false,
      requiresMaterial: false,
      sortOrder: 1,
      isActive: true,
    },
    {
      code: 'BAG-ZIP',
      name: 'Zipper Bag',
      nameTh: 'ถุงซิปล็อค',
      category: 'packaging',
      basePrice: 3.5,
      priceType: 'per_piece',
      requiresDesign: false,
      requiresMaterial: false,
      sortOrder: 2,
      isActive: true,
    },
    {
      code: 'BAG-PAPER',
      name: 'Paper Bag',
      nameTh: 'ถุงกระดาษ',
      category: 'packaging',
      basePrice: 5.0,
      priceType: 'per_piece',
      requiresDesign: true,
      requiresMaterial: false,
      sortOrder: 3,
      isActive: true,
    },
    
    // Labeling (ป้าย/แท็ก)
    {
      code: 'TAG-HANG',
      name: 'Hang Tag',
      nameTh: 'ป้ายห้อย',
      category: 'labeling',
      basePrice: 3.0,
      priceType: 'per_piece',
      requiresDesign: true,
      requiresMaterial: false,
      sortOrder: 4,
      isActive: true,
    },
    {
      code: 'TAG-WOVEN',
      name: 'Woven Label',
      nameTh: 'ป้ายผ้าทอ',
      category: 'labeling',
      basePrice: 4.5,
      priceType: 'per_piece',
      requiresDesign: true,
      requiresMaterial: false,
      sortOrder: 5,
      isActive: true,
    },
    {
      code: 'TAG-PRINT',
      name: 'Printed Label',
      nameTh: 'ป้ายพิมพ์',
      category: 'labeling',
      basePrice: 2.0,
      priceType: 'per_piece',
      requiresDesign: true,
      requiresMaterial: false,
      sortOrder: 6,
      isActive: true,
    },

    // Finishing (งานสำเร็จรูป)
    {
      code: 'FOLD-STANDARD',
      name: 'Standard Folding',
      nameTh: 'พับแพคมาตรฐาน',
      category: 'finishing',
      basePrice: 5.0,
      priceType: 'per_piece',
      requiresDesign: false,
      requiresMaterial: false,
      sortOrder: 7,
      isActive: true,
    },
    {
      code: 'FOLD-PREMIUM',
      name: 'Premium Folding',
      nameTh: 'พับแพคพรีเมี่ยม',
      category: 'finishing',
      basePrice: 8.0,
      priceType: 'per_piece',
      requiresDesign: false,
      requiresMaterial: false,
      sortOrder: 8,
      isActive: true,
    },

    // Extra (เพิ่มเติม)
    {
      code: 'STICKER-CUSTOM',
      name: 'Custom Sticker',
      nameTh: 'สติกเกอร์ออกแบบ',
      category: 'extra',
      basePrice: 150.0,
      priceType: 'per_lot',
      requiresDesign: true,
      requiresMaterial: false,
      sortOrder: 9,
      isActive: true,
    },
  ]

  let created = 0
  let skipped = 0

  for (const addon of addonTypes) {
    const existing = await prisma.addonType.findUnique({
      where: { code: addon.code },
    })

    if (existing) {
      console.log(`⏭️  Skipped: ${addon.nameTh} (${addon.code}) - already exists`)
      skipped++
    } else {
      await prisma.addonType.create({ data: addon })
      console.log(`✅ Created: ${addon.nameTh} (${addon.code}) - ฿${addon.basePrice}`)
      created++
    }
  }

  console.log(`\n📦 Seed Complete:`)
  console.log(`   ✅ Created: ${created}`)
  console.log(`   ⏭️  Skipped: ${skipped}`)
}

main()
  .catch((e) => {
    console.error('❌ Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

