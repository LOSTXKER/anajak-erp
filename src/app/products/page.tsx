'use client'

/**
 * Product List Page
 * หน้าแสดงแค็ตตาล็อกสินค้า (Grid View)
 */

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { useProducts, useDeleteProduct } from '@/features/products/hooks/useProducts'
import { ProductFormDialog } from '@/features/products/components/product-form-dialog'
import { Navbar } from '@/components/layout/navbar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Plus, Search, Package, Edit, Trash2, Loader2, Star, Shirt, Boxes, TrendingUp } from 'lucide-react'
import type { Product } from '@/features/products/types'

export default function ProductsPage() {
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  
  const { data: products, isLoading, error } = useProducts()
  const deleteMutation = useDeleteProduct()

  const handleAdd = () => {
    setSelectedProduct(null)
    setDialogOpen(true)
  }

  const handleEdit = (product: Product) => {
    setSelectedProduct(product)
    setDialogOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (confirm('คุณแน่ใจหรือไม่ที่จะลบสินค้านี้?')) {
      try {
        await deleteMutation.mutateAsync(id)
      } catch (error) {
        alert('เกิดข้อผิดพลาดในการลบสินค้า')
      }
    }
  }

  // Filter products based on search
  const filteredProducts = products?.filter((product) => {
    if (!search) return true
    const searchLower = search.toLowerCase()
    return (
      product.name.toLowerCase().includes(searchLower) ||
      product.name_th.toLowerCase().includes(searchLower) ||
      product.sku.toLowerCase().includes(searchLower)
    )
  })

  // Stats
  const totalProducts = products?.length || 0
  const featuredProducts = products?.filter(p => p.is_featured).length || 0
  const activeProducts = products?.filter(p => p.is_active).length || 0

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-purple-50/30">
      <Navbar />

      {/* Main Content */}
      <main className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-xl">
                <Package className="w-6 h-6 text-purple-600" />
              </div>
              แค็ตตาล็อกสินค้า
            </h1>
            <p className="text-slate-500 mt-1 ml-14">จัดการสินค้าและสต็อกทั้งหมด</p>
          </div>
          <Button 
            size="lg" 
            onClick={handleAdd}
            className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 shadow-lg shadow-purple-500/25"
          >
            <Plus className="mr-2 h-5 w-5" /> เพิ่มสินค้าใหม่
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-0 shadow-sm bg-white/80 backdrop-blur">
            <CardContent className="p-5">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-100 rounded-xl">
                  <Shirt className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-500">สินค้าทั้งหมด</p>
                  <p className="text-2xl font-bold text-slate-900">{totalProducts}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm bg-white/80 backdrop-blur">
            <CardContent className="p-5">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-amber-100 rounded-xl">
                  <Star className="w-6 h-6 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-500">สินค้าแนะนำ</p>
                  <p className="text-2xl font-bold text-amber-600">{featuredProducts}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm bg-white/80 backdrop-blur">
            <CardContent className="p-5">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-emerald-100 rounded-xl">
                  <Boxes className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-500">สินค้าพร้อมขาย</p>
                  <p className="text-2xl font-bold text-emerald-600">{activeProducts}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search Bar */}
        <Card className="border-0 shadow-sm bg-white/80 backdrop-blur">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="ค้นหาสินค้า (ชื่อ, SKU)"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 bg-white border-slate-200"
                />
              </div>
              <Badge variant="secondary" className="px-4 py-2 bg-slate-100">
                {filteredProducts?.length || 0} รายการ
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Products Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <Loader2 className="w-10 h-10 animate-spin text-purple-600 mx-auto mb-3" />
              <p className="text-slate-500">กำลังโหลดข้อมูล...</p>
            </div>
          </div>
        ) : error ? (
          <Card className="border-0 shadow-sm">
            <CardContent className="flex flex-col items-center justify-center h-64 text-slate-400">
              <p className="font-medium">เกิดข้อผิดพลาดในการโหลดข้อมูล</p>
              <p className="text-sm mt-1">กรุณาลองใหม่อีกครั้ง</p>
            </CardContent>
          </Card>
        ) : filteredProducts && filteredProducts.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredProducts.map((product) => (
              <ProductCard 
                key={product.id} 
                product={product}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            ))}
          </div>
        ) : (
          <Card className="border-0 shadow-sm bg-white/90">
            <CardContent className="flex flex-col items-center justify-center h-64 text-slate-400">
              <div className="p-4 bg-slate-100 rounded-full mb-4">
                <Package className="w-10 h-10 opacity-50" />
              </div>
              <p className="font-medium text-slate-600">ยังไม่มีสินค้าในระบบ</p>
              <p className="text-sm mt-1 mb-4">กดปุ่ม "เพิ่มสินค้าใหม่" เพื่อเริ่มต้น</p>
              <Button onClick={handleAdd} variant="outline">
                <Plus className="w-4 h-4 mr-2" /> เพิ่มสินค้าใหม่
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Product Form Dialog */}
        <ProductFormDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          product={selectedProduct}
          onSuccess={() => {
            setDialogOpen(false)
            setSelectedProduct(null)
          }}
        />
      </main>
    </div>
  )
}

// Product Card Component
function ProductCard({ 
  product, 
  onEdit, 
  onDelete 
}: { 
  product: Product
  onEdit: (product: Product) => void
  onDelete: (id: string) => void
}) {
  const typeColors: Record<string, string> = {
    t_shirt: 'from-blue-500 to-blue-600',
    polo: 'from-emerald-500 to-emerald-600',
    jacket: 'from-slate-600 to-slate-700',
    hoodie: 'from-purple-500 to-purple-600',
    custom: 'from-orange-500 to-orange-600',
  }

  const typeLabels: Record<string, string> = {
    t_shirt: 'เสื้อยืด',
    polo: 'เสื้อโปโล',
    jacket: 'แจ็คเก็ต',
    hoodie: 'ฮู้ดดี้',
    custom: 'Custom',
  }

  return (
    <Card className="group border-0 shadow-sm bg-white/90 backdrop-blur hover:shadow-xl transition-all duration-300 overflow-hidden">
      {/* Product Image / Placeholder */}
      <div className={`relative aspect-square bg-gradient-to-br ${typeColors[product.product_type] || 'from-slate-400 to-slate-500'} flex items-center justify-center`}>
        {product.image_url ? (
          <img 
            src={product.image_url} 
            alt={product.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <Shirt className="w-16 h-16 text-white/50" />
        )}
        
        {/* Featured Badge */}
        {product.is_featured && (
          <div className="absolute top-3 left-3">
            <Badge className="bg-amber-500 text-white shadow-lg">
              <Star className="w-3 h-3 mr-1" /> แนะนำ
            </Badge>
          </div>
        )}

        {/* SKU Badge */}
        <div className="absolute top-3 right-3">
          <Badge variant="secondary" className="bg-black/60 text-white text-xs font-mono">
            {product.sku}
          </Badge>
        </div>

        {/* Quick Actions (Hover) */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
          <Button 
            size="icon" 
            variant="secondary"
            className="h-10 w-10 bg-white/90 hover:bg-white"
            onClick={() => onEdit(product)}
          >
            <Edit className="w-4 h-4" />
          </Button>
          <Button 
            size="icon" 
            variant="secondary"
            className="h-10 w-10 bg-white/90 hover:bg-rose-100 text-rose-600"
            onClick={() => onDelete(product.id)}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <CardContent className="p-4">
        <div className="space-y-2">
          {/* Type Badge */}
          <Badge variant="outline" className="text-xs">
            {typeLabels[product.product_type] || product.product_type}
          </Badge>

          {/* Name */}
          <h3 className="font-semibold text-slate-900 line-clamp-1">{product.name_th}</h3>
          <p className="text-sm text-slate-500 line-clamp-1">{product.name}</p>

          {/* Price & Status */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
            <div>
              <span className="text-lg font-bold text-slate-900">
                ฿{product.base_price.toLocaleString()}
              </span>
            </div>
            <div className="text-right">
              <Badge 
                variant="outline"
                className={product.is_active ? 'text-emerald-600 border-emerald-200' : 'text-slate-400'}
              >
                {product.is_active ? 'พร้อมขาย' : 'ปิดการขาย'}
              </Badge>
            </div>
          </div>

          {/* Sizes */}
          {product.available_sizes && product.available_sizes.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-2">
              {product.available_sizes.slice(0, 5).map((size) => (
                <span 
                  key={size} 
                  className="px-2 py-0.5 text-xs bg-slate-100 text-slate-600 rounded"
                >
                  {size}
                </span>
              ))}
              {product.available_sizes.length > 5 && (
                <span className="px-2 py-0.5 text-xs bg-slate-100 text-slate-500 rounded">
                  +{product.available_sizes.length - 5}
                </span>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
