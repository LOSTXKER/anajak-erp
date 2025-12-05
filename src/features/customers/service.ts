/**
 * Customer Service (Prisma Edition)
 * API calls สำหรับจัดการข้อมูลลูกค้า
 */

import prisma from '@/lib/prisma'
import type { Customer, CreateCustomerInput, UpdateCustomerInput, CustomerFilters } from './types'

/**
 * สร้าง Customer Code อัตโนมัติ (CUST-0001, CUST-0002, ...)
 */
async function generateCustomerCode(): Promise<string> {
  const lastCustomer = await prisma.customer.findFirst({
    orderBy: { createdAt: 'desc' },
    select: { customerCode: true }
  })

  if (!lastCustomer) {
    return 'CUST-0001'
  }

  // Extract number from CUST-0001 -> 0001
  const lastNumber = parseInt(lastCustomer.customerCode.split('-')[1] || '0')
  const nextNumber = lastNumber + 1
  return `CUST-${nextNumber.toString().padStart(4, '0')}`
}

/**
 * ดึงรายการลูกค้าทั้งหมด (พร้อม Filters)
 */
export async function getCustomers(filters?: CustomerFilters): Promise<Customer[]> {
  const where: any = {}

  // Apply filters
  if (filters?.search) {
    where.OR = [
      { contactPerson: { contains: filters.search, mode: 'insensitive' } },
      { phone: { contains: filters.search } },
      { email: { contains: filters.search, mode: 'insensitive' } },
      { customerCode: { contains: filters.search, mode: 'insensitive' } },
      { companyName: { contains: filters.search, mode: 'insensitive' } },
    ]
  }

  if (filters?.customer_type) {
    where.customerType = filters.customer_type
  }

  if (filters?.customer_tier) {
    where.customerTier = filters.customer_tier
  }

  if (filters?.is_active !== undefined) {
    where.isActive = filters.is_active
  }

  const customers = await prisma.customer.findMany({
    where,
    orderBy: { createdAt: 'desc' }
  })

  // Convert Prisma model to our Customer type
  return customers.map(mapPrismaToCustomer)
}

/**
 * ดึงข้อมูลลูกค้าตาม ID
 */
export async function getCustomerById(id: string): Promise<Customer | null> {
  const customer = await prisma.customer.findUnique({
    where: { id }
  })

  if (!customer) return null
  return mapPrismaToCustomer(customer)
}

/**
 * สร้างลูกค้าใหม่
 */
export async function createCustomer(input: CreateCustomerInput): Promise<Customer> {
  const customerCode = await generateCustomerCode()

  const customer = await prisma.customer.create({
    data: {
      customerCode,
      contactPerson: input.contact_person,
      phone: input.phone,
      customerType: input.customer_type || 'individual',
      companyName: input.company_name,
      email: input.email,
      lineId: input.line_id,
      address: input.address,
      district: input.district,
      city: input.city,
      province: input.province,
      postalCode: input.postal_code,
      taxId: input.tax_id,
      branch: input.branch || 'สำนักงานใหญ่',
      customerTier: input.customer_tier || 'standard',
      discountPercentage: input.discount_percentage || 0,
      creditLimit: input.credit_limit || 0,
      creditDays: input.credit_days || 0,
      notes: input.notes,
      tags: input.tags || [],
    }
  })

  return mapPrismaToCustomer(customer)
}

/**
 * อัปเดตข้อมูลลูกค้า
 */
export async function updateCustomer(input: UpdateCustomerInput): Promise<Customer> {
  const { id, ...data } = input

  const customer = await prisma.customer.update({
    where: { id },
    data: {
      contactPerson: data.contact_person,
      phone: data.phone,
      customerType: data.customer_type,
      companyName: data.company_name,
      email: data.email,
      lineId: data.line_id,
      address: data.address,
      district: data.district,
      city: data.city,
      province: data.province,
      postalCode: data.postal_code,
      taxId: data.tax_id,
      branch: data.branch,
      customerTier: data.customer_tier,
      discountPercentage: data.discount_percentage,
      creditLimit: data.credit_limit,
      creditDays: data.credit_days,
      notes: data.notes,
      tags: data.tags,
    }
  })

  return mapPrismaToCustomer(customer)
}

/**
 * ลบลูกค้า (Soft Delete - เปลี่ยน isActive = false)
 */
export async function deleteCustomer(id: string): Promise<void> {
  await prisma.customer.update({
    where: { id },
    data: { isActive: false }
  })
}

/**
 * ลบลูกค้าถาวร (Hard Delete - ใช้เมื่อจำเป็นจริงๆ)
 */
export async function permanentDeleteCustomer(id: string): Promise<void> {
  await prisma.customer.delete({
    where: { id }
  })
}

/**
 * Helper: แปลง Prisma model เป็น Customer type
 */
function mapPrismaToCustomer(customer: any): Customer {
  return {
    id: customer.id,
    customer_code: customer.customerCode,
    customer_type: customer.customerType,
    company_name: customer.companyName,
    contact_person: customer.contactPerson,
    email: customer.email,
    phone: customer.phone,
    line_id: customer.lineId,
    address: customer.address,
    district: customer.district,
    city: customer.city,
    province: customer.province,
    postal_code: customer.postalCode,
    tax_id: customer.taxId,
    branch: customer.branch,
    assigned_sales_id: customer.assignedSalesId,
    customer_tier: customer.customerTier,
    discount_percentage: Number(customer.discountPercentage),
    credit_limit: Number(customer.creditLimit),
    credit_days: customer.creditDays,
    total_orders: customer.totalOrders,
    total_revenue: Number(customer.totalRevenue),
    last_order_date: customer.lastOrderDate?.toISOString() || null,
    is_active: customer.isActive,
    notes: customer.notes,
    tags: customer.tags,
    created_at: customer.createdAt.toISOString(),
    updated_at: customer.updatedAt.toISOString(),
  }
}
