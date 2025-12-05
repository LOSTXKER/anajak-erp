'use client'

/**
 * Design Approval Card
 * แสดงรายการ Design Versions และปุ่มอนุมัติ/ปฏิเสธ
 */

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  CheckCircle2, 
  XCircle, 
  Upload, 
  FileImage, 
  Clock,
  AlertCircle 
} from 'lucide-react'
import type { DesignVersion } from '../types'

interface DesignApprovalCardProps {
  orderItemId: string
  orderItemName: string
  designVersions: DesignVersion[]
  onApprove: (versionId: string, notes?: string) => Promise<void>
  onReject: (versionId: string, reason: string) => Promise<void>
  onUploadNew: (orderItemId: string) => void
}

export function DesignApprovalCard({
  orderItemId,
  orderItemName,
  designVersions,
  onApprove,
  onReject,
  onUploadNew,
}: DesignApprovalCardProps) {
  const [selectedVersion, setSelectedVersion] = useState<string | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [approvalNotes, setApprovalNotes] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)

  const currentVersion = designVersions.find(v => v.is_current_version)

  const handleApprove = async () => {
    if (!currentVersion) return
    
    setIsProcessing(true)
    try {
      await onApprove(currentVersion.id, approvalNotes || undefined)
      setApprovalNotes('')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleReject = async () => {
    if (!currentVersion || !rejectionReason.trim()) {
      alert('กรุณาระบุเหตุผลในการปฏิเสธ')
      return
    }
    
    setIsProcessing(true)
    try {
      await onReject(currentVersion.id, rejectionReason)
      setRejectionReason('')
    } finally {
      setIsProcessing(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const config = {
      draft: { label: 'แบบร่าง', variant: 'secondary' as const, className: '' },
      submitted: { label: 'รอตรวจสอบ', variant: 'default' as const, className: '' },
      approved: { label: 'อนุมัติ', variant: 'default' as const, className: 'bg-green-500' },
      rejected: { label: 'ปฏิเสธ', variant: 'destructive' as const, className: '' },
      revision_requested: { label: 'ขอแก้ไข', variant: 'default' as const, className: 'bg-yellow-500' },
    }
    
    const { label, variant, className } = config[status as keyof typeof config] || config.draft
    
    return <Badge variant={variant} className={className || ''}>{label}</Badge>
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{orderItemName}</CardTitle>
          {currentVersion && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-500">
                เวอร์ชัน {currentVersion.version_number}
              </span>
              {getStatusBadge(currentVersion.status)}
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Current Version */}
        {currentVersion ? (
          <div className="space-y-3">
            {/* Mockup Preview */}
            {currentVersion.mockup_url && (
              <div className="relative aspect-video bg-slate-100 rounded-lg overflow-hidden">
                <img 
                  src={currentVersion.mockup_url} 
                  alt="Mockup"
                  className="object-contain w-full h-full"
                />
              </div>
            )}

            {/* Design Files */}
            {currentVersion.design_files.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">ไฟล์ดีไซน์:</p>
                <div className="grid grid-cols-2 gap-2">
                  {currentVersion.design_files.map((file, idx) => (
                    <a
                      key={idx}
                      href={file}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 p-2 bg-slate-50 rounded border hover:bg-slate-100"
                    >
                      <FileImage className="w-4 h-4" />
                      <span className="text-sm truncate">ไฟล์ {idx + 1}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Revision Info */}
            {currentVersion.is_billable && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  การแก้ไขครั้งนี้คิดค่าใช้จ่าย ฿{currentVersion.revision_fee.toLocaleString()}
                </AlertDescription>
              </Alert>
            )}

            {/* Approval Actions */}
            {currentVersion.status === 'submitted' && (
              <div className="space-y-3 pt-3 border-t">
                <div className="space-y-2">
                  <label className="text-sm font-medium">หมายเหตุ (ถ้ามี):</label>
                  <Textarea
                    value={approvalNotes}
                    onChange={(e) => setApprovalNotes(e.target.value)}
                    placeholder="เพิ่มหมายเหตุ..."
                    rows={2}
                  />
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={handleApprove}
                    disabled={isProcessing}
                    className="flex-1 bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    อนุมัติ
                  </Button>
                  <Button
                    onClick={() => setSelectedVersion(currentVersion.id)}
                    disabled={isProcessing}
                    variant="destructive"
                    className="flex-1"
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    ปฏิเสธ
                  </Button>
                </div>

                {/* Rejection Form */}
                {selectedVersion === currentVersion.id && (
                  <div className="space-y-2 pt-2 border-t">
                    <label className="text-sm font-medium text-red-600">
                      เหตุผลในการปฏิเสธ:
                    </label>
                    <Textarea
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="ระบุเหตุผล..."
                      rows={3}
                      className="border-red-300"
                    />
                    <div className="flex gap-2">
                      <Button
                        onClick={handleReject}
                        disabled={isProcessing || !rejectionReason.trim()}
                        variant="destructive"
                        size="sm"
                      >
                        ยืนยันปฏิเสธ
                      </Button>
                      <Button
                        onClick={() => {
                          setSelectedVersion(null)
                          setRejectionReason('')
                        }}
                        variant="outline"
                        size="sm"
                      >
                        ยกเลิก
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Approved Status */}
            {currentVersion.status === 'approved' && (
              <Alert className="bg-green-50 border-green-200">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  อนุมัติแล้วเมื่อ {new Date(currentVersion.approved_at!).toLocaleString('th-TH')}
                </AlertDescription>
              </Alert>
            )}

            {/* Rejected Status */}
            {currentVersion.status === 'rejected' && (
              <div className="space-y-2">
                <Alert variant="destructive">
                  <XCircle className="h-4 w-4" />
                  <AlertDescription>
                    ปฏิเสธแล้ว: {currentVersion.rejection_reason}
                  </AlertDescription>
                </Alert>
                <Button
                  onClick={() => onUploadNew(orderItemId)}
                  variant="outline"
                  className="w-full"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  อัปโหลดไฟล์ใหม่
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8">
            <Clock className="w-12 h-12 mx-auto text-slate-300 mb-3" />
            <p className="text-slate-500">ยังไม่มีดีไซน์</p>
            <Button
              onClick={() => onUploadNew(orderItemId)}
              className="mt-4"
            >
              <Upload className="w-4 h-4 mr-2" />
              อัปโหลดดีไซน์
            </Button>
          </div>
        )}

        {/* Version History */}
        {designVersions.length > 1 && (
          <details className="pt-3 border-t">
            <summary className="text-sm font-medium cursor-pointer text-slate-600 hover:text-slate-900">
              ประวัติการแก้ไข ({designVersions.length} เวอร์ชัน)
            </summary>
            <div className="mt-3 space-y-2">
              {designVersions.map((version) => (
                <div
                  key={version.id}
                  className="flex items-center justify-between p-2 bg-slate-50 rounded text-sm"
                >
                  <div>
                    <span className="font-medium">เวอร์ชัน {version.version_number}</span>
                    {version.revision_notes && (
                      <span className="text-slate-500 ml-2">- {version.revision_notes}</span>
                    )}
                  </div>
                  {getStatusBadge(version.status)}
                </div>
              ))}
            </div>
          </details>
        )}
      </CardContent>
    </Card>
  )
}

