/**
 * Reports & Analytics Page
 */

'use client'

import { useEffect, useState } from 'react'
import { 
  TrendingUp, 
  DollarSign, 
  Package, 
  AlertTriangle,
  Users,
  ShoppingCart,
  Truck,
  FileText
} from 'lucide-react'

export default function ReportsPage() {
  const [summary, setSummary] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/reports/summary')
      .then(res => res.json())
      .then(data => {
        setSummary(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="grid grid-cols-4 gap-4">
            {[1,2,3,4].map(i => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">รายงานและสถิติ</h1>
          <p className="text-gray-500 mt-1">ภาพรวมธุรกิจและการผลิต</p>
        </div>
        <div className="text-sm text-gray-500">
          อัพเดท: {new Date().toLocaleDateString('th-TH', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })}
        </div>
      </div>

      {/* Orders Overview */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">📊 ออเดอร์</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard
            label="ทั้งหมด"
            value={summary?.orders?.total || 0}
            icon={ShoppingCart}
            color="bg-blue-500"
          />
          <StatCard
            label="เดือนนี้"
            value={summary?.orders?.thisMonth || 0}
            icon={TrendingUp}
            color="bg-cyan-500"
          />
          <StatCard
            label="รออนุมัติ"
            value={summary?.orders?.pending || 0}
            icon={Clock}
            color="bg-yellow-500"
          />
          <StatCard
            label="กำลังผลิต"
            value={summary?.orders?.inProduction || 0}
            icon={Package}
            color="bg-purple-500"
          />
          <StatCard
            label="เสร็จสิ้น"
            value={summary?.orders?.completed || 0}
            icon={CheckCircle}
            color="bg-green-500"
          />
        </div>
      </div>

      {/* Revenue Overview */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">💰 รายได้</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard
            label="รายได้เดือนนี้"
            value={`฿${(summary?.revenue?.thisMonth || 0).toLocaleString()}`}
            icon={DollarSign}
            color="bg-green-500"
            large
          />
          <StatCard
            label="รับชำระแล้ว"
            value={`฿${(summary?.revenue?.paymentsReceived || 0).toLocaleString()}`}
            icon={DollarSign}
            color="bg-emerald-500"
            large
          />
          <StatCard
            label="ค้างชำระ"
            value={`฿${(summary?.invoices?.outstandingAmount || 0).toLocaleString()}`}
            icon={FileText}
            color="bg-orange-500"
            large
            subtitle={`${summary?.invoices?.outstanding || 0} ใบแจ้งหนี้`}
          />
        </div>
      </div>

      {/* Alerts */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">⚠️ แจ้งเตือน</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <AlertCard
            label="ปัญหาการผลิต"
            value={summary?.alerts?.openIssues || 0}
            color="bg-red-50 border-red-200 text-red-700"
            icon={AlertTriangle}
          />
          <AlertCard
            label="งานส่งนอก"
            value={summary?.alerts?.pendingOutsource || 0}
            color="bg-yellow-50 border-yellow-200 text-yellow-700"
            icon={Package}
          />
          <AlertCard
            label="วัสดุใกล้หมด"
            value={summary?.alerts?.lowStockMaterials || 0}
            color="bg-orange-50 border-orange-200 text-orange-700"
            icon={AlertTriangle}
          />
          <AlertCard
            label="รอจัดส่ง"
            value={summary?.alerts?.pendingShipments || 0}
            color="bg-blue-50 border-blue-200 text-blue-700"
            icon={Truck}
          />
        </div>
      </div>
    </div>
  )
}

import { CheckCircle, Clock } from 'lucide-react'

function StatCard({ 
  label, 
  value, 
  icon: Icon, 
  color, 
  large,
  subtitle 
}: { 
  label: string
  value: string | number
  icon: any
  color: string
  large?: boolean
  subtitle?: string
}) {
  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 mb-1">{label}</p>
          <p className={`font-bold text-gray-900 ${large ? 'text-3xl' : 'text-2xl'}`}>
            {value}
          </p>
          {subtitle && (
            <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
          )}
        </div>
        <div className={`${color} p-3 rounded-lg`}>
          <Icon className="h-6 w-6 text-white" />
        </div>
      </div>
    </div>
  )
}

function AlertCard({ 
  label, 
  value, 
  color,
  icon: Icon 
}: { 
  label: string
  value: number
  color: string
  icon: any
}) {
  return (
    <div className={`${color} rounded-xl p-4 border-2`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium mb-1">{label}</p>
          <p className="text-3xl font-bold">{value}</p>
        </div>
        <Icon className="h-8 w-8 opacity-70" />
      </div>
    </div>
  )
}

