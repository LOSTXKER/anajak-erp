"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Settings, Building, Palette, Shield, Link2 } from "lucide-react";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">ตั้งค่า</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">ตั้งค่าระบบ Anajak Print</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Company Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Building className="h-4 w-4" />
              ข้อมูลโรงงาน
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium">ชื่อโรงงาน</label>
              <Input placeholder="Anajak Print" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">ที่อยู่</label>
              <Input placeholder="ที่อยู่โรงงาน" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium">โทรศัพท์</label>
                <Input placeholder="0xx-xxx-xxxx" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">เลขผู้เสียภาษี</label>
                <Input placeholder="Tax ID" />
              </div>
            </div>
            <Button>บันทึก</Button>
          </CardContent>
        </Card>

        {/* Production Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Settings className="h-4 w-4" />
              ตั้งค่าการผลิต
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium">จำนวนแก้ไขแบบฟรี</label>
              <Input type="number" defaultValue={3} min={0} />
              <p className="mt-1 text-xs text-slate-400">เกินจำนวนนี้จะมีค่าใช้จ่ายเพิ่ม</p>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">ค่าแก้ไขต่อครั้ง (บาท)</label>
              <Input type="number" defaultValue={500} min={0} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">% มัดจำเริ่มต้น</label>
              <Input type="number" defaultValue={50} min={0} max={100} />
            </div>
            <Button>บันทึก</Button>
          </CardContent>
        </Card>

        {/* Fraud Prevention */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="h-4 w-4" />
              ป้องกันทุจริต
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium">ส่วนลดสูงสุดที่ไม่ต้องอนุมัติ (%)</label>
              <Input type="number" defaultValue={10} min={0} max={100} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">จำนวนยกเลิกบิล/สัปดาห์ ก่อนแจ้งเตือน</label>
              <Input type="number" defaultValue={3} min={1} />
            </div>
            <Button>บันทึก</Button>
          </CardContent>
        </Card>

        {/* Integrations */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Link2 className="h-4 w-4" />
              เชื่อมต่อภายนอก
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Anajak Stock API URL</label>
              <Input placeholder="https://stock.anajak.com/api" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Anajak Stock API Key</label>
              <Input type="password" placeholder="API Key" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">LINE OA Channel Token</label>
              <Input type="password" placeholder="Channel Access Token" />
            </div>
            <Button>บันทึก</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
