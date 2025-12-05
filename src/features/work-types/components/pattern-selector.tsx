'use client'

/**
 * Pattern Selector/Upload
 * สำหรับ Custom Sewing (เลือก Pattern ที่มี) และ Full Custom (Upload Pattern ใหม่)
 */

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Upload, FileText, CheckCircle2, AlertCircle } from 'lucide-react'

interface Pattern {
  id: string
  code: string
  name: string
  category: string
  sizes: string[]
  preview_url?: string
}

interface PatternSelectorProps {
  mode: 'select' | 'upload' // Custom Sewing = select, Full Custom = upload
  onPatternChange: (pattern: Pattern | File | null) => void
}

// Mock patterns (จะดึงจาก API จริง)
const MOCK_PATTERNS: Pattern[] = [
  {
    id: '1',
    code: 'PT-001',
    name: 'เสื้อคอกลม Basic',
    category: 'T-Shirt',
    sizes: ['S', 'M', 'L', 'XL', '2XL'],
  },
  {
    id: '2',
    code: 'PT-002',
    name: 'เสื้อโปโล',
    category: 'Polo',
    sizes: ['S', 'M', 'L', 'XL'],
  },
  {
    id: '3',
    code: 'PT-003',
    name: 'เสื้อแขนยาว',
    category: 'Long Sleeve',
    sizes: ['M', 'L', 'XL'],
  },
]

export function PatternSelector({ mode, onPatternChange }: PatternSelectorProps) {
  const [selectedPattern, setSelectedPattern] = useState<Pattern | null>(null)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [patternNotes, setPatternNotes] = useState('')

  const handlePatternSelect = (pattern: Pattern) => {
    setSelectedPattern(pattern)
    onPatternChange(pattern)
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setUploadedFile(file)
      onPatternChange(file)
    }
  }

  if (mode === 'select') {
    // Custom Sewing: เลือก Pattern ที่มีอยู่
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-blue-600" />
          <h3 className="font-semibold text-slate-900">เลือก Pattern</h3>
          <Badge variant="secondary">มี {MOCK_PATTERNS.length} แบบ</Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {MOCK_PATTERNS.map((pattern) => {
            const isSelected = selectedPattern?.id === pattern.id

            return (
              <Card
                key={pattern.id}
                onClick={() => handlePatternSelect(pattern)}
                className={`
                  cursor-pointer transition-all
                  ${isSelected
                    ? 'ring-2 ring-blue-500 bg-blue-50/50'
                    : 'hover:shadow-md'
                  }
                `}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-xs text-slate-500">{pattern.code}</span>
                        {isSelected && (
                          <CheckCircle2 className="w-4 h-4 text-blue-600" />
                        )}
                      </div>
                      <h4 className="font-medium text-slate-900 mb-1">{pattern.name}</h4>
                      <Badge variant="outline" className="text-xs mb-2">
                        {pattern.category}
                      </Badge>
                      <div className="flex flex-wrap gap-1">
                        {pattern.sizes.map((size) => (
                          <Badge key={size} variant="secondary" className="text-xs">
                            {size}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    )
  }

  // Full Custom: Upload Pattern ใหม่
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Upload className="w-5 h-5 text-purple-600" />
        <h3 className="font-semibold text-slate-900">Upload Pattern Design</h3>
        <Badge className="bg-purple-100 text-purple-700">ต้องการไฟล์</Badge>
      </div>

      {/* Upload Area */}
      <Card className="border-2 border-dashed border-slate-300 hover:border-blue-400 transition-colors">
        <CardContent className="p-8">
          <label className="flex flex-col items-center gap-3 cursor-pointer">
            <div className="p-4 rounded-full bg-blue-50">
              <Upload className="w-8 h-8 text-blue-600" />
            </div>
            <div className="text-center">
              <p className="font-medium text-slate-900">
                คลิกเพื่อเลือกไฟล์ Pattern
              </p>
              <p className="text-sm text-slate-500 mt-1">
                รองรับ .PDF, .DXF, .AI, .CDR (สูงสุด 10MB)
              </p>
            </div>
            <input
              type="file"
              accept=".pdf,.dxf,.ai,.cdr"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>

          {/* Uploaded File Info */}
          {uploadedFile && (
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                <div className="flex-1">
                  <p className="font-medium text-green-900">{uploadedFile.name}</p>
                  <p className="text-sm text-green-700">
                    {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setUploadedFile(null)
                    onPatternChange(null)
                  }}
                  className="text-red-600 hover:text-red-700"
                >
                  ลบ
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pattern Details */}
      <div className="space-y-3">
        <div className="space-y-2">
          <Label>รายละเอียด Pattern</Label>
          <Textarea
            value={patternNotes}
            onChange={(e) => setPatternNotes(e.target.value)}
            placeholder="ระบุรายละเอียด เช่น ไซส์ที่ต้องการ, จำนวนชิ้นส่วน, ข้อกำหนดพิเศษ..."
            rows={3}
          />
        </div>

        {/* Warning */}
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex gap-2">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <div className="text-sm text-amber-800">
              <p className="font-semibold mb-1">หมายเหตุ:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Pattern จะต้องผ่านการตรวจสอบโดยทีมงานก่อน</li>
                <li>อาจมีค่าใช้จ่ายเพิ่มเติมสำหรับการปรับแก้ Pattern</li>
                <li>ระยะเวลาผลิตจะเริ่มนับหลังจาก Pattern อนุมัติแล้ว</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

