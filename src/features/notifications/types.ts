/**
 * Notification Types
 */

export interface Notification {
  id: string
  userId?: string | null
  customerId?: string | null
  type: NotificationType
  title: string
  message: string
  entityType?: string | null
  entityId?: string | null
  channels: NotificationChannel[]
  sentChannels: NotificationChannel[]
  isRead: boolean
  readAt?: string | null
  createdAt: string
}

export type NotificationType = 
  | 'order_status'
  | 'payment_received'
  | 'design_approved'
  | 'design_rejected'
  | 'shipment_update'
  | 'production_issue'
  | 'quotation_sent'
  | 'invoice_due'

export type NotificationChannel = 'app' | 'email' | 'line' | 'sms'

export interface CreateNotificationInput {
  userId?: string
  customerId?: string
  type: NotificationType
  title: string
  message: string
  entityType?: string
  entityId?: string
  channels: NotificationChannel[]
}

export interface NotificationSummary {
  total: number
  unread: number
  recent: Notification[]
}

