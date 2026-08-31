"use client";

/**
 * ตัวอย่าง "หนึ่งหน้าจอของเว็บ" ที่รวมทุกที่ที่มีสีประจำหมวดไว้ในสายตาเดียว
 *
 * ทุกชิ้นเป็น component ตัวจริง — หัวหน้า (PageHeader) · การ์ดตัวเลข (StatCard) ·
 * หัวการ์ด (SectionTitle/ToneMark) · แถบชิปกรองกับตารางของหน้าผลิต
 * (ProductionControlWorklist ตัวจริง ผ่านข้อมูลปลอมชุดเดียวกับ /proto/production-list)
 *
 * ที่เลือกมาสี่หมวดพร้อมกัน เพราะโจทย์คือ "ทั้งเว็บดูเด่นไป" ซึ่งตัดสินจากหน้าเดียว
 * ที่มีสีเดียวไม่ได้ — ต้องเห็นตอนสีหลายหมวดอยู่ในจอเดียวกัน
 */

import {
  Banknote,
  Factory,
  History,
  Package,
  Receipt,
  Shirt,
  Truck,
  Users,
} from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Section, SectionTitle } from "@/components/ui/section";
import { StatCard } from "@/components/ui/stat-card";

import { ProductionControlWorklist } from "@/components/production/production-control-worklist";

import { PROTO_BOARD } from "../production-list/_data";
import { ProtoFreshness } from "../production-list/_shell";
import { useWorklist } from "../production-list/_ui";

/** เรียก ProductionControlWorklist ตัวจริง โดยไม่ต้องมีหัวหน้าซ้ำอีกอัน */
function ProductionWorklistSample() {
  const state = useWorklist(PROTO_BOARD);
  return (
    <ProductionControlWorklist
      board={PROTO_BOARD}
      jobs={state.jobs}
      lens={state.lens}
      sort={state.sort}
      searchDefault={state.search}
      searchInputRef={null}
      onSelectLens={state.setLens}
      onSelectSort={state.setSort}
      onSearchChange={state.setSearch}
      canCreateProduction={false}
      freshness={<ProtoFreshness />}
    />
  );
}

export function QuietScreen() {
  return (
    <div className="space-y-7">
      <PageHeader
        title="ควบคุมการผลิต"
        icon={Factory}
        tone="production"
        description="ดูคิวผลิต งานที่ติดขัด และขั้นตอนที่ต้องจัดการต่อ"
      />

      {/* การ์ดตัวเลขสี่หมวด — จงใจให้สีต่างกันทั้งแถว เพื่อตัดสินว่า "ดังไป" ไหม */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard moduleTone="production" title="งานในสายผลิต" value={12} icon={Factory} />
        <StatCard moduleTone="product" title="เสื้อในสต๊อก" value="3,480" icon={Shirt} />
        <StatCard moduleTone="finance" title="ค้างชำระ" value="฿284,600" icon={Banknote} />
        <StatCard moduleTone="brand" title="ลูกค้าใหม่เดือนนี้" value={7} icon={Users} />
      </div>

      {/* หัวการ์ดสี่ใบ — จุดที่ซ้ำมากที่สุดในเว็บ (63 ที่ทั่วระบบ) */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Section surface="card" title={<SectionTitle icon={Package} tone="product">รายการสินค้า (3) · 240 ชิ้น</SectionTitle>}>
          <p className="text-sm text-secondary">
            เสื้อโปโล Dry-Tech สีกรมท่า 120 ตัว · เสื้อยืดคอกลม สีขาว 80 ตัว ·
            เสื้อแขนยาว สีดำ 40 ตัว
          </p>
        </Section>
        <Section surface="card" title={<SectionTitle icon={Receipt} tone="finance">บิลและการชำระเงิน</SectionTitle>}>
          <p className="text-sm text-secondary">
            มัดจำแล้ว 50% (฿69,120) · คงเหลือ ฿69,120 · เครดิต 30 วัน
          </p>
        </Section>
        <Section surface="card" title={<SectionTitle icon={Truck} tone="production">การจัดส่ง</SectionTitle>}>
          <p className="text-sm text-secondary">
            ส่งเอง · นัดรับ 31 ส.ค. 2569 · คุณเมย์ 08x-xxx-xxxx
          </p>
        </Section>
        <Section surface="card" title={<SectionTitle icon={History} tone="system">ประวัติการเปลี่ยนแปลง</SectionTitle>}>
          <p className="text-sm text-secondary">
            29 ส.ค. เปลี่ยนกำหนดส่ง · 27 ส.ค. อนุมัติม็อกอัพ v3 · 25 ส.ค. เปิดออเดอร์
          </p>
        </Section>
      </div>

      {/* หน้าผลิตของจริง (แบบ C ที่เพิ่งลง) — มีทั้งชิปสีและจุดสีสถานะในที่เดียว */}
      <ProductionWorklistSample />
    </div>
  );
}
