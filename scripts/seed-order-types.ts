/**
 * Seed Order Types & Work Types
 * ประเภทงาน และ หมวดงาน
 */

import prisma from '../src/lib/prisma'

async function main() {
  console.log('🌱 Seeding Order Types & Work Types...\n')

  // 1. Order Types (4 ประเภทงาน)
  console.log('📋 Creating Order Types...')
  
  const orderTypes = [
    {
      code: 'ready_made',
      name: 'Ready-Made',
      nameTh: 'เสื้อสำเร็จรูป',
      description: 'เสื้อสำเร็จรูปนำมาสกรีน/ปัก',
      defaultLeadDays: 5,
      requiresPattern: false,
      requiresFabric: false,
      sortOrder: 1,
    },
    {
      code: 'custom_sewing',
      name: 'Custom Sewing',
      nameTh: 'ตัดเย็บตามแบบ',
      description: 'ตัดเย็บตาม Pattern ที่มีอยู่',
      defaultLeadDays: 14,
      requiresPattern: true,
      requiresFabric: true,
      sortOrder: 2,
    },
    {
      code: 'full_custom',
      name: 'Full Custom',
      nameTh: 'ออกแบบ+ตัดเย็บ',
      description: 'ออกแบบ Pattern ใหม่ + ตัดเย็บ',
      defaultLeadDays: 21,
      requiresPattern: true,
      requiresFabric: true,
      sortOrder: 3,
    },
    {
      code: 'print_only',
      name: 'Print Only',
      nameTh: 'สกรีน/ปักอย่างเดียว',
      description: 'สกรีน หรือ ปัก (ไม่รวมเสื้อ)',
      defaultLeadDays: 3,
      requiresPattern: false,
      requiresFabric: false,
      sortOrder: 4,
    },
  ]

  for (const type of orderTypes) {
    await prisma.orderType.upsert({
      where: { code: type.code },
      update: type,
      create: type,
    })
    console.log(`  ✓ ${type.nameTh} (${type.defaultLeadDays} วัน)`)
  }

  // 2. Work Types (หมวดงาน)
  console.log('\n🛠️ Creating Work Types...')
  
  const workTypes = [
    // PRINTING
    { code: 'dtf', name: 'DTF Printing', nameTh: 'DTF', category: 'PRINTING', requiresDesign: true, defaultPrice: 50, sortOrder: 1 },
    { code: 'dtg', name: 'DTG Printing', nameTh: 'DTG', category: 'PRINTING', requiresDesign: true, defaultPrice: 80, sortOrder: 2 },
    { code: 'silkscreen', name: 'Silkscreen', nameTh: 'สกรีน', category: 'PRINTING', requiresDesign: true, defaultPrice: 30, sortOrder: 3 },
    { code: 'sublimation', name: 'Sublimation', nameTh: 'ซับลิเมชั่น', category: 'PRINTING', requiresDesign: true, defaultPrice: 70, sortOrder: 4 },
    { code: 'vinyl', name: 'Vinyl Print', nameTh: 'ไวนิล', category: 'PRINTING', requiresDesign: true, defaultPrice: 40, sortOrder: 5 },
    
    // EMBROIDERY
    { code: 'embroidery', name: 'Embroidery', nameTh: 'ปัก', category: 'EMBROIDERY', requiresDesign: true, defaultPrice: 100, sortOrder: 10 },
    { code: 'embroidery_badge', name: 'Embroidery Badge', nameTh: 'ปักอาร์ม', category: 'EMBROIDERY', requiresDesign: true, defaultPrice: 80, sortOrder: 11 },
    
    // GARMENT
    { code: 'pattern', name: 'Pattern Making', nameTh: 'ทำ Pattern', category: 'GARMENT', requiresDesign: true, defaultPrice: 500, sortOrder: 20 },
    { code: 'cutting', name: 'Cutting', nameTh: 'ตัดผ้า', category: 'GARMENT', requiresMaterial: true, defaultPrice: 20, sortOrder: 21 },
    { code: 'sewing', name: 'Sewing', nameTh: 'เย็บ', category: 'GARMENT', requiresMaterial: true, defaultPrice: 50, sortOrder: 22 },
    
    // LABELING
    { code: 'woven_label', name: 'Woven Label', nameTh: 'ป้ายทอ', category: 'LABELING', requiresDesign: true, requiresMaterial: true, defaultPrice: 5, sortOrder: 30 },
    { code: 'printed_label', name: 'Printed Label', nameTh: 'ป้ายพิมพ์', category: 'LABELING', requiresDesign: true, requiresMaterial: true, defaultPrice: 3, sortOrder: 31 },
    { code: 'leather_tag', name: 'Leather Tag', nameTh: 'แท็กหนัง', category: 'LABELING', requiresDesign: true, requiresMaterial: true, defaultPrice: 15, sortOrder: 32 },
    
    // FINISHING
    { code: 'wash', name: 'Wash', nameTh: 'ซัก', category: 'FINISHING', defaultPrice: 10, sortOrder: 40 },
    { code: 'press', name: 'Press', nameTh: 'รีด', category: 'FINISHING', defaultPrice: 3, sortOrder: 41 },
    { code: 'steam', name: 'Steam', nameTh: 'นึ่ง', category: 'FINISHING', defaultPrice: 5, sortOrder: 42 },
    { code: 'spray_treatment', name: 'Spray Treatment', nameTh: 'สเปรย์กันน้ำ/กันยับ', category: 'FINISHING', defaultPrice: 10, sortOrder: 43 },
  ]

  for (const type of workTypes) {
    await prisma.workType.upsert({
      where: { code: type.code },
      update: type,
      create: type,
    })
    console.log(`  ✓ [${type.category}] ${type.nameTh} - ฿${type.defaultPrice}`)
  }

  console.log('\n✅ Seed completed!')
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

