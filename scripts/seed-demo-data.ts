/**
 * Seed Script: Add Demo Data for Testing
 * สร้างข้อมูลทดสอบ (ลูกค้า + สินค้า)
 */

import prisma from '../src/lib/prisma'

async function main() {
  console.log('🌱 Starting Demo Data Seed...\n')

  // Create Demo Customers
  const customers = [
    {
      customerCode: 'CUST-001',
      contactPerson: 'สมชาย ใจดี',
      companyName: 'บริษัท เสื้อสวยดี จำกัด',
      phone: '081-234-5678',
      email: 'somchai@test.com',
      address: '123 ถ.พระราม 4 แขวงสีลม เขตบางรัก กทม. 10500',
      taxId: '0105558888001',
    },
    {
      customerCode: 'CUST-002',
      contactPerson: 'สมหญิง รักสะอาด',
      companyName: 'ร้าน ออฟฟิศเสื้อผ้า',
      phone: '082-345-6789',
      email: 'somying@test.com',
      address: '456 ถ.สุขุมวิท แขวงคลองเตย เขตคลองเตย กทม. 10110',
      taxId: null,
    },
  ]

  for (const customer of customers) {
    const existing = await prisma.customer.findUnique({
      where: { customerCode: customer.customerCode },
    })

    if (existing) {
      console.log(`⏭️  Skipped Customer: ${customer.companyName}`)
    } else {
      await prisma.customer.create({ data: customer })
      console.log(`✅ Created Customer: ${customer.companyName}`)
    }
  }

  // Create Demo Products
  const products = [
    {
      sku: 'TS-001',
      productType: 't_shirt',
      name: 'T-Shirt Round Neck Cotton 100%',
      nameTh: 'เสื้อยืดคอกลม Cotton 100%',
      materialType: 'cotton',
      basePrice: 120.0,
      availableSizes: ['S', 'M', 'L', 'XL', 'XXL'],
      imageUrl: null,
    },
    {
      sku: 'TS-002',
      productType: 'polo',
      name: 'Polo Shirt Cotton + Polyester',
      nameTh: 'เสื้อโปโล Cotton + Polyester',
      materialType: 'tc_blend',
      basePrice: 180.0,
      availableSizes: ['S', 'M', 'L', 'XL'],
      imageUrl: null,
    },
    {
      sku: 'TS-003',
      productType: 't_shirt',
      name: 'Sport T-Shirt Dry-Fit',
      nameTh: 'เสื้อกีฬา Dry-Fit',
      materialType: 'microfiber',
      basePrice: 150.0,
      availableSizes: ['S', 'M', 'L', 'XL', 'XXL'],
      imageUrl: null,
    },
  ]

  for (const product of products) {
    const existing = await prisma.product.findUnique({
      where: { sku: product.sku },
    })

    if (existing) {
      console.log(`⏭️  Skipped Product: ${product.name}`)
    } else {
      await prisma.product.create({ data: product })
      console.log(`✅ Created Product: ${product.name}`)
    }
  }

  console.log(`\n✅ Demo Data Seeded!`)
}

main()
  .catch((e) => {
    console.error('❌ Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

