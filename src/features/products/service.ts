/**
 * Product Service (Prisma Edition)
 * API calls สำหรับจัดการข้อมูลสินค้า
 */

import prisma from '@/lib/prisma'
import type { Product, CreateProductInput, UpdateProductInput, ProductFilters } from './types'

/**
 * สร้าง SKU อัตโนมัติ (TS-COT-WHT-001)
 */
async function generateSKU(productType: string, color?: string): Promise<string> {
  const typePrefix = productType.substring(0, 2).toUpperCase()
  const colorPrefix = color ? color.substring(0, 3).toUpperCase() : 'XXX'
  
  const count = await prisma.product.count()
  const nextNumber = count + 1
  
  return `${typePrefix}-${colorPrefix}-${nextNumber.toString().padStart(3, '0')}`
}

/**
 * ดึงรายการสินค้าทั้งหมด (พร้อม Filters)
 */
export async function getProducts(filters?: ProductFilters): Promise<Product[]> {
  const where: any = {}

  // Apply filters
  if (filters?.search) {
    where.OR = [
      { name: { contains: filters.search, mode: 'insensitive' } },
      { nameTh: { contains: filters.search, mode: 'insensitive' } },
      { sku: { contains: filters.search, mode: 'insensitive' } },
    ]
  }

  if (filters?.product_type) {
    where.productType = filters.product_type
  }

  if (filters?.is_active !== undefined) {
    where.isActive = filters.is_active
  }

  if (filters?.is_featured !== undefined) {
    where.isFeatured = filters.is_featured
  }

  const products = await prisma.product.findMany({
    where,
    orderBy: { createdAt: 'desc' }
  })

  return products.map(mapPrismaToProduct)
}

/**
 * ดึงข้อมูลสินค้าตาม ID
 */
export async function getProductById(id: string): Promise<Product | null> {
  const product = await prisma.product.findUnique({
    where: { id }
  })

  if (!product) return null
  return mapPrismaToProduct(product)
}

/**
 * สร้างสินค้าใหม่
 */
export async function createProduct(input: CreateProductInput): Promise<Product> {
  const sku = await generateSKU(input.product_type, input.base_color || undefined)
  
  // Generate slug from name
  const slug = input.name.toLowerCase().replace(/\s+/g, '-')

  const product = await prisma.product.create({
    data: {
      sku,
      slug,
      productType: input.product_type,
      name: input.name,
      nameTh: input.name_th,
      description: input.description,
      materialType: input.material_type,
      weightGsm: input.weight_gsm,
      baseColor: input.base_color,
      availableSizes: input.available_sizes || [],
      costPrice: input.cost_price || 0,
      basePrice: input.base_price,
      lowStockThreshold: input.low_stock_threshold || 10,
      imageUrl: input.image_url,
      mockupTemplateUrl: input.mockup_template_url,
      isFeatured: input.is_featured || false,
    }
  })

  return mapPrismaToProduct(product)
}

/**
 * อัปเดตข้อมูลสินค้า
 */
export async function updateProduct(input: UpdateProductInput): Promise<Product> {
  const { id, ...data } = input

  const product = await prisma.product.update({
    where: { id },
    data: {
      productType: data.product_type,
      name: data.name,
      nameTh: data.name_th,
      description: data.description,
      materialType: data.material_type,
      weightGsm: data.weight_gsm,
      baseColor: data.base_color,
      availableSizes: data.available_sizes,
      costPrice: data.cost_price,
      basePrice: data.base_price,
      lowStockThreshold: data.low_stock_threshold,
      imageUrl: data.image_url,
      mockupTemplateUrl: data.mockup_template_url,
      isFeatured: data.is_featured,
    }
  })

  return mapPrismaToProduct(product)
}

/**
 * ลบสินค้า (Soft Delete - เปลี่ยน isActive = false)
 */
export async function deleteProduct(id: string): Promise<void> {
  await prisma.product.update({
    where: { id },
    data: { isActive: false }
  })
}

/**
 * ลบสินค้าถาวร (Hard Delete)
 */
export async function permanentDeleteProduct(id: string): Promise<void> {
  await prisma.product.delete({
    where: { id }
  })
}

/**
 * Helper: แปลง Prisma model เป็น Product type
 */
function mapPrismaToProduct(product: any): Product {
  return {
    id: product.id,
    sku: product.sku,
    product_type: product.productType,
    name: product.name,
    name_th: product.nameTh,
    description: product.description,
    material_type: product.materialType,
    weight_gsm: product.weightGsm,
    base_color: product.baseColor,
    available_sizes: product.availableSizes,
    cost_price: Number(product.costPrice),
    base_price: Number(product.basePrice),
    track_inventory: product.trackInventory,
    low_stock_threshold: product.lowStockThreshold,
    image_url: product.imageUrl,
    mockup_template_url: product.mockupTemplateUrl,
    is_active: product.isActive,
    is_featured: product.isFeatured,
    slug: product.slug,
    created_at: product.createdAt.toISOString(),
    updated_at: product.updatedAt.toISOString(),
  }
}
