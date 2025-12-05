/**
 * Test Database Connection with Prisma
 * Run: npx tsx scripts/test-db.ts
 */

import prisma from '../src/lib/prisma'

async function main() {
  console.log('🔍 Testing Prisma connection to Supabase...\n')

  try {
    // Test 1: Connection
    console.log('1️⃣ Testing connection...')
    await prisma.$connect()
    console.log('✅ Connected successfully!\n')

    // Test 2: Query Database
    console.log('2️⃣ Testing query...')
    const customerCount = await prisma.customer.count()
    const productCount = await prisma.product.count()
    console.log(`✅ Found ${customerCount} customers`)
    console.log(`✅ Found ${productCount} products\n`)

    // Test 3: Create Test Customer
    console.log('3️⃣ Creating test customer...')
    const testCustomer = await prisma.customer.create({
      data: {
        customerCode: `TEST-${Date.now()}`,
        contactPerson: 'ทดสอบ ระบบ',
        phone: '0812345678',
        email: 'test@example.com',
        customerType: 'individual',
      }
    })
    console.log(`✅ Created customer: ${testCustomer.customerCode}\n`)

    // Test 4: Read Customer
    console.log('4️⃣ Reading customer...')
    const foundCustomer = await prisma.customer.findUnique({
      where: { id: testCustomer.id }
    })
    console.log(`✅ Found: ${foundCustomer?.contactPerson}\n`)

    // Test 5: Update Customer
    console.log('5️⃣ Updating customer...')
    const updatedCustomer = await prisma.customer.update({
      where: { id: testCustomer.id },
      data: { notes: 'Updated via test script' }
    })
    console.log(`✅ Updated notes: ${updatedCustomer.notes}\n`)

    // Test 6: Delete Customer
    console.log('6️⃣ Deleting test customer...')
    await prisma.customer.delete({
      where: { id: testCustomer.id }
    })
    console.log(`✅ Deleted successfully\n`)

    console.log('🎉 All tests passed! Prisma is working correctly with Supabase.\n')
    console.log('Next steps:')
    console.log('  - Run: npm run dev')
    console.log('  - Visit: http://localhost:3000/customers')
    console.log('  - Try adding real customers!\n')

  } catch (error) {
    console.error('❌ Error:', error)
    console.error('\nTroubleshooting:')
    console.error('  1. Check DATABASE_URL in .env.local')
    console.error('  2. Make sure Supabase project is running')
    console.error('  3. Run: npx prisma db push')
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()

