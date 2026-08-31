"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { ArrowLeft, ExternalLink, Moon, Smartphone, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented";

import { useProtoFlag, useProtoVariant } from "../_kit/use-proto-variant";
import { LookPreview, type LookVariant } from "./_blocks";

/* --------------------------------------------------------------- ทางเลือก */
// กติกา: "ปัจจุบัน" มาก่อนเสมอ · ทุกทางมีข้อแลก · ต่างกันที่วิธีคิด ไม่ใช่แค่เฉดสี

const OPTIONS = [
  { value: "current", label: "ของจริงตอนนี้" },
  { value: "rank", label: "A · ตัวเลขมีที่ยืน" },
  { value: "module", label: "B · สีบอกหมวด" },
  { value: "alive", label: "C · มีชีวิต" },
] as const;

const VALUES = OPTIONS.map((option) => option.value) as readonly LookVariant[];

const COPY: Record<
  LookVariant,
  { name: string; idea: string; summary: string; tradeoff: string }
> = {
  current: {
    name: "ของจริงตอนนี้ — เงียบทั้งเว็บ",
    idea: "เงียบไว้ก่อน สีสงวนไว้ให้เรื่องด่วน",
    summary:
      "ทุกอย่างเป็นตัวหนังสือบนการ์ดขาว · สีมีแค่สามที่ คือ ลิงก์ (น้ำเงิน) เตือน (เหลือง) อันตราย (แดง) · ป้ายสถานะเป็นวงแหวนบางไม่มีพื้นสี — ข้อนี้เบสเคาะเองเมื่อ 25 ส.ค. หลังเห็นว่าพื้นสีเรียงกันในตารางกลายเป็นพรมสีจนไม่มีอะไรเด่น · ประวัติลูกค้าเป็นบรรทัดเทาเล็กใต้ชื่อ",
    tradeoff:
      "อ่านทั้งวันไม่ล้า และของด่วนเด่นจริงเพราะไม่มีอะไรมาแข่ง — แต่ของที่ “พิเศษ” (ยอดสะสม · จำนวนครั้ง · วงเงิน) หน้าตาเท่ากับข้อความประกอบทุกตัว ต้องอ่านจนจบบรรทัดถึงจะรู้ว่ามีข้อมูลอะไรอยู่",
  },
  rank: {
    name: "A · ตัวเลขมีที่ยืน",
    idea: "ปัญหาไม่ใช่ “ไม่มีสี” แต่คือ “ทุกอย่างตัวเท่ากัน”",
    summary:
      "ไม่เพิ่มสีสักเฉด แต่ให้ของสำคัญมีที่ยืนของตัวเอง — ประวัติลูกค้ากลับมาเป็นสี่ช่องคั่นเส้นบาง ป้ายเล็กอยู่บน ตัวเลขตัวหนาอยู่ล่าง · ตัวเลขสรุปหน้าแรกยุบจากการ์ดสี่ใบลอย ๆ เป็นแผงเดียวแบ่งช่อง · แถวออเดอร์จัดใหม่ให้เลขที่ใบกับยอดเงินเป็นสองเสาหลัก ที่เหลือถอยไปเป็นตัวรอง",
    tradeoff:
      "โมเดิร์นแบบเครื่องมือทำงาน (แนว Linear/Stripe) และไม่มีทางเลอะ เพราะไม่มีสีใหม่เข้ามาเลย — แต่ถ้าสิ่งที่อยากได้คือ “เห็นสี” จริง ๆ แบบนี้จะรู้สึกว่าเปลี่ยนน้อย · การ์ดลูกค้าสูงขึ้นราว 60 px เพราะสี่ช่องกินที่กว่าบรรทัดเดียว",
  },
  module: {
    name: "B · สีบอกหมวด",
    idea: "ให้สีทำงาน — สีบอกว่า “นี่เรื่องอะไร” ไม่ใช่ประดับ",
    summary:
      "ปลุกชุดสีประจำหมวดที่ระบบมีอยู่แล้วตั้งแต่ P1.0 แต่แทบไม่ได้ใช้ (แบรนด์ = น้ำเงิน · ผลิต = เขียวอมฟ้า · สินค้า = ทอง · การเงิน = ม่วง · ระบบ = เทา ทุกเฉดมีคู่โหมดมืดครบแล้ว) — ประวัติลูกค้าเป็นสี่กล่องสีตามความหมาย (เงินเป็นม่วง จำนวนครั้งเป็นน้ำเงิน) · ไอคอนหัวการ์ดมีกล่องสี · แถวออเดอร์มีแถบสีซ้ายบอกว่าใบนี้อยู่มือใคร (เราพิมพ์เอง / ร้านนอก / รอส่ง) เห็นแต่ไกลโดยไม่ต้องอ่าน",
    tradeoff:
      "เปิดหน้ามารู้ทันทีว่าอะไรเรื่องเงิน อะไรเรื่องผลิต — แต่นี่คือการกลับคำตัดสินของตัวเองเมื่อ 25 ส.ค. (ตอนนั้นเอาพื้นสีออกเพราะเรียงกันแล้วเป็นพรมสี) · ยิ่งมีสีประจำหมวดมาก แดงกับเหลืองที่แปลว่า “ต้องรีบ” ยิ่งต้องแข่งกับสีสวย ๆ รอบตัว · ใบที่ยอดเป็น ฿0 จะได้กล่องสีสวยที่ข้างในว่างเปล่า (กดสลับเป็นใบที่เบสถ่ายมาดูได้)",
  },
  alive: {
    name: "C · มีชีวิต",
    idea: "เว็บควรรู้สึกมีชีวิต ไม่ใช่ตารางข้อมูล",
    summary:
      "เอาแบบ B มาแล้วเติมความลึกกับการเคลื่อนไหว — การ์ดลูกค้ามีแถบไล่สีบนสุดและรูปวงกลมย่อชื่อ · ยอดสะสมเป็นตัวเลขใหญ่ในกล่องไล่สี พร้อมแถบบอกว่าใช้วงเงินไปกี่เปอร์เซ็นต์ · การ์ดตัวเลขยกขึ้นตอนเอาเมาส์ชี้ ลูกศรเลื่อนตาม · แถวออเดอร์มีรูปย่อกับแถบความคืบหน้าว่าเดินไปกี่ช่วงแล้ว · พื้นหลังหน้าไล่สีอ่อนแทนเทาเรียบ",
    tradeoff:
      "ทันสมัยที่สุดและ “มีอะไร” ที่สุด — แต่ขยับเข้าใกล้หน้าตาแอปการตลาด มากกว่าหน้าจอที่ทีมต้องนั่งจ้องทั้งวัน · แถบวงเงินต้องขอข้อมูลเพิ่มหนึ่งก้อนที่หน้าใบงานยังไม่เคยยิง (ระบบคำนวณไว้แล้วที่หน้าลูกค้า จึงไม่ใช่ของใหม่ แต่ก็ไม่ฟรี) · ของประดับทุกชิ้นต้องมีสถานะว่างของตัวเอง ไม่งั้นใบที่ข้อมูลไม่ครบจะดูเหมือนหน้าพัง",
  },
};

/** ข้อเท็จจริงที่ต้องรู้ก่อนตัดสิน — ไม่ใช่ความเห็น */
const NOTES = [
  "สีทุกเฉดในแบบ B และ C ไม่ได้คิดขึ้นใหม่ — เป็นชุดสีประจำหมวดที่อยู่ใน globals.css มาตั้งแต่ P1.0 มีคู่โหมดมืดและผ่านเกณฑ์คอนทราสต์แล้ว (วันนี้ถูกใช้จริงแค่ไอคอนเมนูซ้ายกับรูปย่อชื่อ)",
  "ทั้งสี่แบบใช้ข้อมูลชุดเดียวกันเป๊ะ ไม่มีแบบไหนได้เปรียบเพราะตัดของออกหรือใส่ของเพิ่ม",
  "ลูกค้าตัวอย่างมีสองใบ: ใบที่เบสถ่ายมา (ยอด ฿0 · 6 ครั้ง · ไม่มีบริษัท/เลขภาษี/วงเงิน) กับลูกค้าประจำยอดหลักล้านข้อมูลครบ — กดสลับดูได้ ของพังตอนค่าว่างเสมอ",
  "แบบที่เลือกจะกลายเป็นภาษาใหม่ของทั้งเว็บ ไม่ใช่แค่สามบล็อกนี้ — สามบล็อกนี้เลือกมาเพราะครอบสามสถานการณ์ที่ต่างกันที่สุด (ของชิ้นเดียว · ตัวเลขสรุป · ของเรียงกันเป็นแถว)",
  "แถวออเดอร์ในหน้านี้เขียนขึ้นตามของจริง ไม่ได้ยกตัวจริงมา เพราะตัวจริงผูกกับฐานข้อมูล — ส่วนการ์ดลูกค้ากับการ์ดตัวเลขใช้ชิ้นส่วนตัวจริงของระบบ (Section · Badge · Button · StatCard · ช่องข้อมูล)",
] as const;

/** สิ่งที่หน้าลองนี้ยังไม่ครอบ — เขียนไว้ให้เห็น ดีกว่าให้มาจับได้ทีหลัง */
const OUT_OF_SCOPE = [
  "เทียบแค่ “ผิว” — ทุกแบบวางของชิ้นเดิมไว้ที่เดิม ไม่มีแบบไหนย้ายหรือรื้อโครงหน้า",
  "ยังไม่แตะ: เมนูซ้าย · แถบบน · ฟอร์มกรอกข้อมูล · ตารางเต็มหน้า · จอทัชในโรงงาน · เอกสารสั่งพิมพ์ (สองอันหลังมีกติกาสีของตัวเองอยู่แล้ว)",
  "ปุ่มทุกปุ่มกดแล้วยังไม่ทำอะไร (เปิดหน้าลูกค้า · ดูทั้งหมด · การ์ดตัวเลข · แถวออเดอร์)",
  "ไม่มีตัวเลขที่ระบบไม่มีจริงในหน้านี้ — ยอดสะสม จำนวนครั้ง วันสั่งล่าสุด วงเงิน และภาระหนี้ มีของจริงครบทุกตัว",
] as const;

const subscribeNever = () => () => {};
const getTrue = () => true;
const getFalse = () => false;

export default function LookProtoPage() {
  const [variant, setVariant] = useProtoVariant<LookVariant>("v", VALUES, "current");
  const [plain, togglePlain] = useProtoFlag("plain");
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(subscribeNever, getTrue, getFalse);
  const isDark = mounted && resolvedTheme === "dark";
  const copy = COPY[variant];

  const src = `/proto/look/view?v=${variant}&plain=${plain ? "1" : "0"}`;

  return (
    <main className="min-h-screen bg-surface-muted px-4 py-8 text-strong sm:px-6 lg:px-10">
      <div className="mx-auto max-w-[1500px]">
        <Link
          href="/proto"
          className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-secondary"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          หน้าลองทั้งหมด
        </Link>

        <h1 className="mt-3 text-2xl font-semibold sm:text-3xl">
          ทั้งเว็บควรมีสีและลูกเล่นแค่ไหน
        </h1>
        <p className="mt-2 max-w-4xl text-sm text-secondary">
          เบสทักว่าของที่ “พิเศษ” ถูกเขียนเป็นตัวหนังสือธรรมดา และทั้งเว็บคลีนไปหน่อย
          อยากได้ความโมเดิร์นกับสีมากขึ้น — สามแบบข้างล่างคิดคนละอย่างว่า “เติมอะไร” ถึงจะได้แบบนั้น
          โดยไม่ทำให้ของด่วนจมหายไปกับของสวย · เลือกมาหนึ่งแบบแล้วค่อยลงมือกับของจริงทั้งเว็บ
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
            <Button variant="outline" size="sm" onClick={togglePlain}>
              {plain ? "ดูลูกค้าประจำ (ข้อมูลครบ)" : "ดูใบที่เบสถ่ายมา (ยอด ฿0)"}
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
        <section className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="border-l-2 border-blue-600 pl-4 dark:border-blue-400">
            <p className="text-xs font-medium text-muted">วิธีคิด: {copy.idea}</p>
            <h2 className="mt-1 text-lg font-semibold">{copy.name}</h2>
            <p className="mt-2 text-sm text-secondary">{copy.summary}</p>
            <p className="mt-2 text-sm text-amber-800 dark:text-amber-200">
              <span className="font-medium">ข้อแลก:</span> {copy.tradeoff}
            </p>
          </div>
          <div className="card-surface rounded-2xl p-4 text-sm">
            <p className="font-medium">สิ่งที่ต้องรู้ก่อนตัดสิน</p>
            <ul className="mt-2 space-y-2 text-xs text-secondary">
              {NOTES.map((note) => (
                <li key={note} className="flex gap-1.5">
                  <span aria-hidden="true" className="text-muted">
                    ·
                  </span>
                  <span>{note}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* จอคอม */}
        <section className="mt-8">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-medium text-muted">บนคอม</p>
            <span className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() =>
                  window.open(src, "proto-look-mobile", "width=390,height=820,noopener")
                }
                className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:underline dark:text-blue-400"
              >
                เปิดขนาดมือถือ (390)
                <Smartphone className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
              <a
                href={src}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:underline dark:text-blue-400"
              >
                เปิดเต็มหน้าจอ
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
            </span>
          </div>
          <LookPreview variant={variant} plain={plain} />
        </section>

        <section className="mt-10 card-surface rounded-2xl p-5">
          <h2 className="text-sm font-semibold">หน้าลองนี้ยังไม่ครอบอะไรบ้าง</h2>
          <ul className="mt-2 space-y-2 text-xs text-secondary">
            {OUT_OF_SCOPE.map((item) => (
              <li key={item} className="flex gap-1.5">
                <span aria-hidden="true" className="text-muted">
                  ·
                </span>
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
