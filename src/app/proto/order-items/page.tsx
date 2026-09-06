"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { ArrowLeft, Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented";
// "ปัจจุบัน" = component ตัวจริงของแท็บรายการ ต่างจากหน้าจริงแค่ข้อมูลปลอม
import { OrderItemsDisplay } from "@/components/orders/detail/order-items-display";

import { useProtoFlag, useProtoVariant } from "../_kit/use-proto-variant";
import { demoFacts, demoFees, demoItems, type DemoVariant } from "./_data";
import { FormLikeVariant } from "./_variants/form-like";
import { InvoiceVariant } from "./_variants/invoice";

/* --------------------------------------------------------------- ทางเลือก */
// กติกา: "ปัจจุบัน" มาก่อนเสมอ · ทุกทางต้องมีข้อแลก · ต่างกันที่วิธีคิด ไม่ใช่แค่สี

const OPTIONS = [
  { value: "current", label: "ปัจจุบัน" },
  { value: "form", label: "A · เหมือนหน้าแก้ไข" },
  { value: "invoice", label: "B · อ่านเหมือนบิล" },
] as const;

type Variant = (typeof OPTIONS)[number]["value"];
const VALUES = OPTIONS.map((option) => option.value) as readonly Variant[];

const COPY: Record<Variant, { name: string; idea: string; summary: string; tradeoff: string }> = {
  current: {
    name: "ปัจจุบัน — ของจริงที่เบสส่งรูปมา (6 ก.ย.)",
    idea: "แสดง “ทุกอย่างที่ระบบรู้” เป็นก้อน ๆ เรียงลง",
    summary:
      "เสื้อแต่ละตัวเป็นก้อนของตัวเอง (ชื่อ · ป้าย · แพค · ตารางย่อย สี/ไซส์/จำนวน · แถวรวม) แล้วต่อด้วยตารางงานพิมพ์ · ตารางส่วนเสริม · ตารางสรุปราคา — เสื้อตัวเดียวกัน 2 ไซส์จึงกลายเป็น 2 ก้อนที่หน้าตาซ้ำกัน และคำว่า “รวม 1” โผล่หลายที่ทั้งที่ทั้งใบมีแค่ 2 ตัว",
    tradeoff:
      "คนเปิดมาต้องอ่านทีละก้อนแล้วประกอบเองว่าใบนี้สั่งอะไรเท่าไร · หน้าตาไม่เหมือนตอนกรอก พอกดแก้ไขแล้วกลับมาดู ต้องปรับตาใหม่",
  },
  form: {
    name: "A · เหมือนหน้าแก้ไข",
    idea: "ดูกับแก้ควรเป็นหน้าเดียวกัน แค่ถอดช่องกรอกออก",
    summary:
      "ลอกโครงหน้าสร้าง/แก้มาทั้งชุด: หนึ่งชุดงานหนึ่งการ์ด → ตารางลาย (ลาย · วิธีพิมพ์ · ขนาด · กว้าง×สูง · ตำแหน่ง · จำนวนสี · ค่าสกรีน) → ตารางเสื้อ (แหล่ง · สินค้า · แพค · ราคา · ส่วนลด · จำนวน · รวม แถวละตัว) → ตารางส่วนเสริม → สรุปราคา · คอลัมน์ตัวเลขทั้งสามตารางตรงกันเหมือนฟอร์ม · เสื้อตัดเย็บ/ลูกค้าส่งมาเป็นกล่องจมมีตารางไซส์ (ไซส์บน จำนวนล่าง) เหมือนตอนกรอก",
    tradeoff:
      "เสื้อสต๊อกที่สั่ง 5 ไซส์จะเป็น 5 แถวในตาราง (ฟอร์มก็เป็นแบบนั้น) · ลำดับ “ลายมาก่อนเสื้อ” ตามฟอร์ม ซึ่งคนอ่านบางคนอยากเห็นเสื้อก่อน · ยังมี 3–4 ตารางต่อชุดงาน ใบยาวใกล้เคียงเดิม แต่ตารางเรียงเป็นระเบียบกว่า",
  },
  invoice: {
    name: "B · อ่านเหมือนบิล",
    idea: "คนเปิดแท็บนี้อยากรู้แค่ “สั่งอะไร กี่ตัว เท่าไร” — บิลตอบได้ในตารางเดียว",
    summary:
      "หนึ่งชุดงาน = ตารางเดียว 4 คอลัมน์ (รายการ · ราคา/หน่วย · จำนวน · รวม) เรียงบรรทัด: เสื้อแถวละสี+ไซส์ → ลายแถวละจุด (×จำนวนเสื้อ) → ส่วนเสริม → รวมชุดงาน · แพค/แหล่ง/รหัสอยู่บรรทัดเล็กใต้ชื่อ · สเปกเสื้อตัดเย็บและบันทึกตรวจรับอยู่ในกล่องเหนือตาราง ไม่ปนกับตัวเลข",
    tradeoff:
      "ออเดอร์หลายสีหลายไซส์ได้บรรทัดเยอะ (5 ไซส์ × 3 สี = 15 แถวของเสื้อตัวเดียว) · ไม่มีหมวด “ลาย/เสื้อ/ส่วนเสริม” ให้กวาดตาหา ต้องอ่านไล่ลง · หน้าตาไม่เหมือนตอนแก้ไขเลย",
  },
};

/** สิ่งที่หน้าลองนี้ยังไม่ครอบ — เขียนไว้ให้เห็น ดีกว่าให้มาจับได้ทีหลัง */
const OUT_OF_SCOPE = [
  "เทียบเฉพาะ “การ์ดรายการสินค้า + การ์ดค่าธรรมเนียม” ในแท็บรายการ — หัวใบ แถบสถานะ แถบแท็บ และการ์ดใบแก้ไขออเดอร์ (ท้ายแท็บ) ไม่อยู่ในหน้าลอง เพราะไม่ได้เปลี่ยน",
  "ปุ่ม “แก้ไข” กดแล้วยังไม่ไปไหน · ช่องบันทึกตรวจรับเสื้อของลูกค้า (สภาพ/ติ๊กตรวจแล้ว/หมายเหตุ) ในแบบ A/B เป็นตัวหนังสืออ่านอย่างเดียว — ตอนลงจริงจะใช้ฟอร์มตัวเดิมที่มีอยู่แล้วในหน้าปัจจุบัน",
  "แบบ A ตัดคอลัมน์ปุ่มลบ/จัดลำดับท้ายตาราง (44px) ทิ้ง เพราะหน้าดูไม่มีอะไรให้กด — ความกว้างคอลัมน์อื่นเท่าฟอร์มทุกช่อง",
  "ชื่อประเภทส่วนเสริม (SIZE_LABEL · NECK_LABEL · SETUP) เป็นรหัสภายในทั้งในฟอร์มและในหน้าลอง — ของจริงเก็บมาแบบนี้ ไม่ได้แปลให้ในรอบนี้",
  "กรอบมือถือข้างล่างย่อได้จริงเฉพาะแบบ A/B (ตัดสินจากความกว้างของกล่อง) — แบบ “ปัจจุบัน” ตัดสินจากความกว้างหน้าต่างเบราว์เซอร์ ในกรอบแคบจึงยังวางแบบจอกว้าง อยากดูของจริงบนมือถือให้ย่อหน้าต่างหรือเปิดลิงก์บนมือถือ",
] as const;

const subscribeNever = () => () => {};
const getTrue = () => true;
const getFalse = () => false;

function Preview({
  variant,
  data,
  showMoney,
}: {
  variant: Variant;
  data: DemoVariant;
  showMoney: boolean;
}) {
  const items = demoItems(data);
  const fees = demoFees(data);
  if (variant === "form") return <FormLikeVariant items={items} fees={fees} showMoney={showMoney} />;
  if (variant === "invoice") return <InvoiceVariant items={items} fees={fees} showMoney={showMoney} />;
  return (
    <div className="space-y-6">
      <OrderItemsDisplay
        orderId="demo-order"
        items={items}
        fees={fees}
        onEditItems={() => {}}
        showMoney={showMoney}
        canEditReceiveTracking={false}
      />
    </div>
  );
}

export default function OrderItemsProtoPage() {
  const [variant, setVariant] = useProtoVariant<Variant>("v", VALUES, "current");
  const [complex, toggleComplex] = useProtoFlag("complex");
  const [hideMoney, toggleHideMoney] = useProtoFlag("nomoney");
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(subscribeNever, getTrue, getFalse);
  const isDark = mounted && resolvedTheme === "dark";
  const copy = COPY[variant];
  const data: DemoVariant = complex ? "complex" : "simple";
  const facts = demoFacts(data);
  const showMoney = !hideMoney;

  const notes = [
    `ใบตัวอย่างนี้มี ${facts.items} ชุดงาน · เสื้อ ${facts.products} รายการ (${facts.variants} สี/ไซส์) · ลาย ${facts.prints} จุด · ส่วนเสริม ${facts.addons} อย่าง — ทั้ง 3 แบบใช้ข้อมูลชุดเดียวกันจากไฟล์เดียว ไม่มีแบบไหนได้เปรียบเพราะตัดของออก`,
    complex
      ? "ใบนี้คือเคสยากที่เจอจริง: เสื้อตัดเย็บใหม่ 5 ไซส์ มีส่วนลดต่อชิ้น · ปัก + DTF · ส่วนเสริมคิดต่อชิ้นและต่อออเดอร์ · ชุดสองเป็นเสื้อลูกค้าส่งมา (ไม่คิดราคาตัวเสื้อ มีบันทึกตรวจรับ) · ค่าธรรมเนียม 2 รายการ · ชื่อสินค้ายาว 1 บรรทัดครึ่ง"
      : "ใบนี้คือใบจริงในรูปที่เบสส่งมา: เสื้อสต๊อกตัวเดียวกัน 2 ไซส์ · DTG หน้า 1 จุด · ป้ายไซส์ 2 ชิ้น · รวม ฿480 — กดปุ่ม “ดูใบซับซ้อน” เพื่อดูว่าแต่ละแบบรับมือเคสยากยังไง",
    "ตัวเลขทุกช่อง (รวม/เฉลี่ย/ยอดชุดงาน) คิดจากสูตรกลางตัวเดียวกับที่ server เก็บเงินจริง ไม่ได้พิมพ์ตัวเลขใส่มือ",
    "หัวการ์ด “รายการสินค้า · ชิปจำนวน · ปุ่มแก้ไข” และการ์ดค่าธรรมเนียม ใช้ข้อความชุดเดียวกันทุกแบบโดยตั้งใจ — สิ่งที่ต่างคือเนื้อในเท่านั้น",
  ];

  return (
    <main className="min-h-screen bg-surface-muted px-4 py-8 text-strong sm:px-6 lg:px-10">
      <div className="mx-auto max-w-[1500px]">
        <Link href="/proto" className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-secondary">
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          หน้าลองทั้งหมด
        </Link>

        <h1 className="mt-3 text-2xl font-semibold sm:text-3xl">
          แท็บรายการของออเดอร์ควรวางข้อมูลแบบไหน
        </h1>
        <p className="mt-2 max-w-4xl text-sm text-secondary">
          เบสเห็นแท็บรายการแล้วบอกว่า “แสดงผลออกมาได้งงมาก — แสดงเหมือนตอนแก้ไขหรือสร้างจะมองง่ายกว่า”
          หน้านี้วางของจริงตอนนี้ เทียบกับแบบที่ล้อหน้าแก้ไข และแบบที่อ่านเหมือนบิล — เลือกมาหนึ่งแบบแล้วค่อยลงมือกับหน้าจริง
        </p>

        {/* แถวควบคุม */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="overflow-x-auto pb-1">
              <SegmentedControl
                options={OPTIONS.map((option) => ({ ...option }))}
                value={variant}
                onChange={setVariant}
                aria-label="เลือกแบบที่จะดู"
                className="min-w-max"
              />
            </div>
            <Button variant="outline" size="sm" onClick={toggleComplex}>
              {complex ? "ดูใบง่าย (ใบในรูปของเบส)" : "ดูใบซับซ้อน (2 ชุดงาน · 5 ไซส์ · เสื้อลูกค้า)"}
            </Button>
            <Button variant="outline" size="sm" onClick={toggleHideMoney}>
              {hideMoney ? "ดูแบบเจ้าของ (เห็นเงิน)" : "ดูแบบช่าง (ไม่เห็นเงิน)"}
            </Button>
          </div>
          <Button
            variant="outline"
            size="icon-sm"
            aria-label={isDark ? "ดูแบบโหมดสว่าง" : "ดูแบบโหมดมืด"}
            onClick={() => setTheme(isDark ? "light" : "dark")}
          >
            {isDark ? <Moon /> : <Sun />}
          </Button>
        </div>

        {/* คำอธิบายแบบที่เลือกอยู่ */}
        <section className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="border-l-2 border-blue-600 pl-4 dark:border-blue-400">
            <p className="text-2xs font-medium uppercase tracking-wide text-muted">วิธีคิด: {copy.idea}</p>
            <h2 className="mt-1 text-lg font-semibold">{copy.name}</h2>
            <p className="mt-1.5 text-sm text-secondary">{copy.summary}</p>
            <p className="mt-2 text-sm text-amber-800 dark:text-amber-200">
              <span className="font-medium">ข้อแลก:</span> {copy.tradeoff}
            </p>
          </div>
          <div className="card-surface rounded-2xl p-4 text-sm">
            <p className="font-medium">สิ่งที่ต้องรู้ก่อนตัดสิน</p>
            <ul className="mt-2 space-y-1.5 text-xs text-secondary">
              {notes.map((note) => (
                <li key={note} className="flex gap-1.5">
                  <span aria-hidden="true" className="text-muted">·</span>
                  <span>{note}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* บนคอม — กว้างเท่าพื้นที่เนื้อหาจริงของหน้าออเดอร์ */}
        <section className="mt-8">
          <p className="mb-2 text-2xs font-medium uppercase tracking-wide text-muted">บนคอม (กว้างเท่าแท็บรายการของจริง)</p>
          <div className="overflow-hidden rounded-2xl bg-bg px-4 py-6 ring-1 ring-inset ring-border sm:px-6 lg:px-8">
            <Preview variant={variant} data={data} showMoney={showMoney} />
          </div>
        </section>

        {/* บนมือถือ — กรอบ 390px */}
        <section className="mt-8">
          <p className="mb-2 text-2xs font-medium uppercase tracking-wide text-muted">บนมือถือ (390px)</p>
          <div className="w-full max-w-[390px] overflow-hidden rounded-[2rem] bg-bg p-3 ring-1 ring-inset ring-border">
            <Preview variant={variant} data={data} showMoney={showMoney} />
          </div>
        </section>

        <section className="mt-10 card-surface rounded-2xl p-5">
          <h2 className="text-sm font-semibold">หน้าลองนี้ยังไม่ครอบอะไรบ้าง</h2>
          <ul className="mt-2 space-y-1.5 text-xs text-secondary">
            {OUT_OF_SCOPE.map((item) => (
              <li key={item} className="flex gap-1.5">
                <span aria-hidden="true" className="text-muted">·</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-muted">
            ข้อมูลทุกอย่างในหน้านี้เป็นของปลอมและไม่ได้ต่อฐานข้อมูล — กดอะไรก็ไม่กระทบงานจริง
          </p>
        </section>
      </div>
    </main>
  );
}
