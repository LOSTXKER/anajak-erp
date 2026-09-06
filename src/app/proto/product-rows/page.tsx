"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { ArrowLeft, Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented";
import type { OrderItemProductForm } from "@/types/order-form";

import { useProtoFlag, useProtoVariant } from "../_kit/use-proto-variant";
import { demoProducts, type DemoCase } from "./_data";
import { useProtoProducts } from "./_shared";
import { CurrentVariant } from "./_variants/current";
import { TableDetailVariant } from "./_variants/table-detail";
import { SizeRowsVariant } from "./_variants/size-rows";
import { TableCollapsedVariant } from "./_variants/table-collapsed";
import { TablePopupVariant } from "./_variants/table-popup";

/* --------------------------------------------------------------- ทางเลือก */
// กติกา: "ปัจจุบัน" มาก่อนเสมอ · ทุกทางต้องมีข้อแลก · ต่างกันที่วิธีคิด ไม่ใช่แค่สี

const OPTIONS = [
  { value: "current", label: "ปัจจุบัน" },
  { value: "detail", label: "A · ตาราง + แถวลูกกางตลอด" },
  { value: "rows", label: "B · แถวละไซส์" },
  { value: "collapsed", label: "C · ตาราง + สเปคพับได้" },
  { value: "popup", label: "D · ตาราง + สเปคใน popup" },
] as const;

type Variant = (typeof OPTIONS)[number]["value"];
const VALUES = OPTIONS.map((o) => o.value) as readonly Variant[];

const COPY: Record<Variant, { name: string; idea: string; summary: string; tradeoff: string }> = {
  current: {
    name: "ปัจจุบัน — กล่องเทาต่อสินค้า",
    idea: "เสื้อตัดเย็บ/ลูกค้าส่งมามีช่องเยอะกว่าสต๊อก จึงแยกเป็นกล่องของตัวเอง",
    summary:
      "ชุดงานที่มีเสื้อตัดเย็บหรือลูกค้าส่งมาแม้แค่ตัวเดียว ทุกสินค้าในชุดนั้นจะกลายเป็นกล่องพื้นเทาเรียงลงมา (รวมเสื้อสต๊อกด้วย) — หัวกล่อง “สินค้า 1/1” + ป้ายแหล่ง · ชื่อสินค้า · แพค · ราคา/ส่วนลด/รวม · สเปคตัดเย็บ 9 ช่อง · ตารางไซส์ · ส่วนสต๊อกล้วนเป็นตาราง 8 คอลัมน์",
    tradeoff:
      "เบสบอกเอง: ไม่เป็นระเบียบ ไม่ชอบพื้นเทา · ชุดงานเดียวกันหน้าตาเปลี่ยนไปมาระหว่าง “ตาราง” กับ “กล่อง” แล้วแต่ว่ามีเสื้อประเภทไหนปน",
  },
  detail: {
    name: "A · ตารางเดียว + แถวลูกกางตลอด",
    idea: "ทุกสินค้าคือแถวในตารางเดียวกัน ของที่มีมากกว่าแถวหนึ่งรับได้ก็เป็น “แถวลูก” ใต้แถวนั้น",
    summary:
      "สต๊อก ตัดเย็บ ลูกค้าส่งมา อยู่ตาราง 8 คอลัมน์เดียวกันเสมอ (แหล่ง · สินค้า · แพค · ราคา · ส่วนลด · จำนวน · รวม · จัดการ) · เสื้อตัดเย็บได้แถวลูกพื้นขาวมีเส้นบางซ้าย = สเปค 9 ช่อง (ซ้าย) + ตารางไซส์ S/M/L (ขวา) · เสื้อลูกค้าได้แถวลูก = ตารางไซส์อย่างเดียว · จำนวนรวมกับยอดรวมของสินค้านั้นอยู่บนแถวหลักตรงคอลัมน์เดียวกับสต๊อก · จอแคบเป็นการ์ดขอบบางพื้นขาว",
    tradeoff:
      "ชุดงานที่มีตัดเย็บหลายรายการ ตารางจะสูงมาก (แถวลูกสเปค 3 บรรทัดต่อรายการ) · ตารางมี 2 ชั้นในตัวเอง ต้องอ่านให้ออกว่าแถวไหนเป็นลูกของแถวไหน — ใช้เส้นบางซ้ายบอก",
  },
  rows: {
    name: "B · แถวละไซส์ (เหมือนแท็บรายการ)",
    idea: "ฟอร์มควรมองเห็นเหมือนหน้าดูที่เพิ่งเคาะ — เสื้อ 1 ไซส์ = 1 แถว",
    summary:
      "แถวหลักของสินค้าเหมือน A แต่แถวลูกเป็น “ตารางไซส์แถวละบรรทัด” (ไซส์ · สี · จำนวน · รวมแถว · ลบ) + ปุ่มเพิ่มไซส์ · เห็นยอดต่อไซส์ทันที · สีตั้งต่างกันต่อไซส์ได้ · สเปคตัดเย็บอยู่ใต้ตารางไซส์อีกชั้น · หน้าตาสอดคล้องกับแท็บรายการที่แสดงเสื้อแถวละตัว",
    tradeoff:
      "กรอกช้ากว่า: ไม่มีช่อง S/M/L/XL สำเร็จรูปให้พิมพ์ตัวเลขรัวๆ ต้องกด “เพิ่มไซส์” ทีละแถว (5 ไซส์ = กด 5 ครั้ง + พิมพ์ชื่อไซส์เอง) · ชุดงาน 5 ไซส์ยาวกว่า A · ตัวเลขรวมแถวซ้ำกับคอลัมน์รวมบนแถวหลัก",
  },
  collapsed: {
    name: "C · ตาราง + สเปคพับได้",
    idea: "ตอนกรอกออเดอร์ส่วนใหญ่ไม่ได้แก้สเปคทุกครั้ง — โชว์แค่สรุป กดเมื่อจะแก้",
    summary:
      "แถวหลักเหมือน A · แถวลูกเป็นบรรทัดสรุปชิป: “สเปค: โปโล TC 220 แกรม กรมท่า คอโปโล แขนสั้น Regular” + ปุ่มแก้สเปค · “90 ตัว: S 10 M 25 L 30 XL 20 2XL 5” + ปุ่มแก้ไซส์ · กดปุ่มค่อยกางช่องกรอกชุดเดิม (สเปค 9 ช่อง / ตารางไซส์ S/M/L) · ตารางเตี้ยที่สุดใน 3 ทาง",
    tradeoff:
      "ของที่ต้องกรอกซ่อนหลังปุ่ม — ตอนสร้างออเดอร์ใหม่ต้องกด “แก้ไซส์” ก่อนถึงจะกรอกจำนวนได้ (เพิ่มคลิก 1 ครั้งต่อรายการ) · ลืมกรอกสเปคง่ายขึ้นเพราะไม่เห็นช่องว่างจ้องอยู่ · สรุปชิปยาวได้ถ้าสเปคครบทุกช่อง",
  },
  popup: {
    name: "D · ตาราง + สเปคใน popup (แบบผสม)",
    idea: "ของที่กรอกทุกออเดอร์ (ไซส์) ต้องเห็นตลอด · ของที่กรอกนานๆ ครั้งแต่ช่องเยอะ (สเปค 9 ช่อง) ไปอยู่ใน popup",
    summary:
      "แถวหลักเหมือน A · แถวลูกมีแค่ตารางไซส์ S/M/L กางตลอด (พิมพ์ตัวเลขรัวได้ ยอดขยับทันที) · สเปคตัดเย็บเป็นบรรทัดชิปสรุป + ปุ่ม “แก้สเปค” เปิด popup ที่มีตัวเลือกแพทเทิร์น + 9 ช่องเต็มๆ · ยังไม่กรอกสเปค = ชิปเตือนสีเหลือง “ยังไม่ระบุสเปค” ไม่ปล่อยให้เงียบ · เสื้อลูกค้าส่งมาไม่มี popup เลย (มีแค่ไซส์) · ตารางเตี้ยใกล้ C แต่กรอกไซส์เร็วเท่า A",
    tradeoff:
      "แก้สเปคต้องเปิด-ปิด popup (เพิ่มคลิก 2 ครั้งต่อรายการที่ตัดเย็บ) · ตอนกรอกสเปคจะมองไม่เห็นแถวอื่นในตาราง · ถ้าเบสตัดเย็บบ่อยและแก้สเปคเกือบทุกออเดอร์ A จะเร็วกว่า",
  },
};

/** สิ่งที่หน้าลองนี้ยังไม่ครอบ — เขียนไว้ให้เห็น ดีกว่าให้มาจับได้ทีหลัง */
const OUT_OF_SCOPE = [
  "เทียบเฉพาะหมวด “สินค้าในชุดงาน” ในการ์ดชุดงานของฟอร์มสร้าง/แก้ออเดอร์ — ชื่อชุดงาน ลาย ส่วนเสริม หมายเหตุ สรุปราคา ไม่อยู่ในหน้าลองเพราะไม่ได้เปลี่ยน",
  "ช่อง “เลือกแพทเทิร์น” ในแบบ A/B/C เป็นรายการปลอม 2 ชื่อ และปุ่ม “สร้างแพทเทิร์นใหม่” กดแล้วไม่เปิดฟอร์ม — ของจริงดึงแพทเทิร์นจากฐานและมีฟอร์มสร้างด่วนอยู่แล้ว (CustomMadeDetail) ตอนลงจริงใช้ตัวเดิม · แบบ “ปัจจุบัน” ใช้ตัวจริงจึงต่อฐานจริง",
  "รายการแพคในแบบ A/B/C เป็นของปลอม 3 ตัวเลือก (ของจริงดึงจากตั้งค่า) · ปุ่ม “เพิ่มสินค้า” ยังไม่เปิดเมนูเลือกแหล่ง",
  "แบบ B ยังไม่มีปุ่ม “ใส่ไซส์มาตรฐาน S–3XL ให้เลย” — ถ้าเบสเลือก B ควรเพิ่มปุ่มนี้ตอนลงจริงเพื่อลดการกดเพิ่มทีละแถว",
  "การ์ดจอแคบของทุกแบบเขียนใหม่ให้พื้นขาวขอบบาง (ของจริงตอนนี้จอแคบก็ใช้กล่องเทาเดียวกับคอม) — กรอบมือถือย่อได้จริงเพราะตัดสินจากความกว้างของกล่อง",
] as const;

const subscribeNever = () => () => {};
const getTrue = () => true;
const getFalse = () => false;

function Preview({ variant, demo }: { variant: Variant; demo: DemoCase }) {
  const [products, h] = useProtoProducts(demoProducts(demo));
  const [current, setCurrent] = useState<OrderItemProductForm[]>(() => demoProducts(demo));
  if (variant === "current") return <CurrentVariant products={current} setProducts={setCurrent} />;
  if (variant === "detail") return <TableDetailVariant products={products} h={h} />;
  if (variant === "rows") return <SizeRowsVariant products={products} h={h} />;
  if (variant === "popup") return <TablePopupVariant products={products} h={h} />;
  return <TableCollapsedVariant products={products} h={h} />;
}

export default function ProductRowsProtoPage() {
  const [variant, setVariant] = useProtoVariant<Variant>("v", VALUES, "current");
  const [complex, toggleComplex] = useProtoFlag("complex");
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(subscribeNever, getTrue, getFalse);
  const isDark = mounted && resolvedTheme === "dark";
  const copy = COPY[variant];
  const demo: DemoCase = complex ? "complex" : "simple";

  const notes = [
    complex
      ? "ชุดงานนี้คือเคสยากที่เจอจริง: เสื้อสต๊อก 1 รายการ + เสื้อตัดเย็บใหม่ 5 ไซส์ กรอกสเปคครบ 9 ช่อง มีส่วนลดต่อชิ้น + เสื้อลูกค้าส่งมา 3 ไซส์ — อยู่ในชุดงานเดียวกัน ทุกแบบต้องรับได้ทั้ง 3 แหล่งพร้อมกัน"
      : "ชุดงานนี้คือใบในรูปที่เบสส่งมา: เสื้อลูกค้าส่งมา 1 รายการ ชื่อ “dfdf” ไซส์ S/M/L/XL รวม 5 ตัว — กดปุ่ม “ดูชุดงานซับซ้อน” เพื่อดูว่าแต่ละแบบรับเคส 3 แหล่งปนกันยังไง",
    "ช่องกรอกทุกช่องพิมพ์ได้จริง (ตัวเลขรวมคิดใหม่ตามที่พิมพ์) แต่ไม่บันทึกที่ไหน รีเฟรชแล้วกลับเป็นค่าตั้งต้น",
    "แถวหลัก 8 คอลัมน์ในแบบ A/B/C/D ใช้ความกว้างคอลัมน์ชุดเดียวกับตารางสต๊อกของจริง (เบสสั่ง 08-03 ให้คอลัมน์ทุกตารางในชุดงานตรงกัน) — สิ่งที่ต่างกันคือแถวลูกใต้แถวหลักเท่านั้น",
    "ทั้ง 4 แบบไม่มีกล่องพื้นเทาแล้ว: รายละเอียดใต้แถวเป็นพื้นขาว มีเส้นบางด้านซ้ายบอกว่าเป็นลูกของแถวบน (ตามที่เบสบอกว่าไม่ชอบพื้นหลังเทา)",
  ];

  return (
    <main className="min-h-screen bg-surface-muted px-4 py-8 text-strong sm:px-6 lg:px-10">
      <div className="mx-auto max-w-[1500px]">
        <Link href="/proto" className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-secondary">
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          หน้าลองทั้งหมด
        </Link>

        <h1 className="mt-3 text-2xl font-semibold sm:text-3xl">
          สินค้าตัดเย็บ/ลูกค้าส่งมาในฟอร์มควรวางแบบไหน
        </h1>
        <p className="mt-2 max-w-4xl text-sm text-secondary">
          เบสเห็นฟอร์มแล้วบอกว่า “ทำให้ดีกว่านี้ได้มั้ย เป็นระบบระเบียบ ไม่ชอบพื้นหลังเทา ทำเป็นตารางได้มั้ย”
          หน้านี้วางกล่องเทาของจริงตอนนี้ เทียบกับ 4 ทางที่ทุกสินค้าอยู่ในตารางเดียวกัน (D = แบบผสม popup ที่เบสถามเพิ่ม) — ต่างกันที่ว่า “ของที่เกินหนึ่งแถว” (ไซส์หลายไซส์ สเปคตัดเย็บ) ไปอยู่ตรงไหน
        </p>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="overflow-x-auto pb-1">
              <SegmentedControl options={OPTIONS.map((o) => ({ ...o }))} value={variant} onChange={setVariant} aria-label="เลือกแบบที่จะดู" className="min-w-max" />
            </div>
            <Button variant="outline" size="sm" onClick={toggleComplex}>
              {complex ? "ดูชุดงานง่าย (ใบในรูปของเบส)" : "ดูชุดงานซับซ้อน (สต๊อก + ตัดเย็บ 5 ไซส์ + เสื้อลูกค้า)"}
            </Button>
          </div>
          <Button variant="outline" size="icon-sm" aria-label={isDark ? "ดูแบบโหมดสว่าง" : "ดูแบบโหมดมืด"} onClick={() => setTheme(isDark ? "light" : "dark")}>
            {isDark ? <Moon /> : <Sun />}
          </Button>
        </div>

        <section className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="border-l-2 border-blue-600 pl-4 dark:border-blue-400">
            <p className="text-2xs font-medium uppercase tracking-wide text-muted">วิธีคิด: {copy.idea}</p>
            <h2 className="mt-1 text-lg font-semibold">{copy.name}</h2>
            <p className="mt-1.5 text-sm text-secondary">{copy.summary}</p>
            <p className="mt-2 text-sm text-amber-800 dark:text-amber-200"><span className="font-medium">ข้อแลก:</span> {copy.tradeoff}</p>
          </div>
          <div className="card-surface rounded-2xl p-4 text-sm">
            <p className="font-medium">สิ่งที่ต้องรู้ก่อนตัดสิน</p>
            <ul className="mt-2 space-y-1.5 text-xs text-secondary">
              {notes.map((note) => (
                <li key={note} className="flex gap-1.5"><span aria-hidden="true" className="text-muted">·</span><span>{note}</span></li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mt-8">
          <p className="mb-2 text-2xs font-medium uppercase tracking-wide text-muted">บนคอม (กว้างเท่าการ์ดชุดงานของจริง)</p>
          <div className="card-surface rounded-2xl p-4 sm:p-5">
            <Preview key={`${variant}-${demo}-wide`} variant={variant} demo={demo} />
          </div>
        </section>

        <section className="mt-8">
          <p className="mb-2 text-2xs font-medium uppercase tracking-wide text-muted">บนมือถือ (390px)</p>
          <div className="w-full max-w-[390px] overflow-hidden rounded-[2rem] bg-bg p-3 ring-1 ring-inset ring-border">
            <div className="card-surface rounded-2xl p-3">
              <Preview key={`${variant}-${demo}-narrow`} variant={variant} demo={demo} />
            </div>
          </div>
        </section>

        <section className="mt-10 card-surface rounded-2xl p-5">
          <h2 className="text-sm font-semibold">หน้าลองนี้ยังไม่ครอบอะไรบ้าง</h2>
          <ul className="mt-2 space-y-1.5 text-xs text-secondary">
            {OUT_OF_SCOPE.map((item) => (
              <li key={item} className="flex gap-1.5"><span aria-hidden="true" className="text-muted">·</span><span>{item}</span></li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-muted">ข้อมูลทุกอย่างในหน้านี้เป็นของปลอม (ยกเว้นรายการแพคของแบบ “ปัจจุบัน”) — กดอะไรก็ไม่กระทบงานจริง</p>
        </section>
      </div>
    </main>
  );
}
