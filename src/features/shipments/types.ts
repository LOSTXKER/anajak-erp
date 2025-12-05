/**
 * Shipment Types
 */

export interface Shipment {
  id: string
  shipmentNumber: string
  orderId: string
  shippingMethod: ShippingMethod
  courierName?: string | null
  trackingNumber?: string | null
  shippingCost: number
  recipientName: string
  recipientPhone: string
  shippingAddress: string
  scheduledDate?: string | null
  scheduledTime?: string | null
  shippedAt?: string | null
  deliveredAt?: string | null
  status: ShipmentStatus
  proofOfDelivery?: string | null
  receiverSignature?: string | null
  notes?: string | null
  createdAt: string
  updatedAt: string
  // Relations
  order?: any
}

export type ShippingMethod = 'pickup' | 'delivery' | 'courier'
export type ShipmentStatus = 'pending' | 'preparing' | 'shipped' | 'in_transit' | 'delivered' | 'returned'

export interface CreateShipmentInput {
  orderId: string
  shippingMethod: ShippingMethod
  courierName?: string
  recipientName: string
  recipientPhone: string
  shippingAddress: string
  scheduledDate?: string
  scheduledTime?: string
  shippingCost?: number
  notes?: string
}

export interface UpdateShipmentInput {
  trackingNumber?: string
  status?: ShipmentStatus
  shippedAt?: string
  deliveredAt?: string
  proofOfDelivery?: string
  receiverSignature?: string
}

