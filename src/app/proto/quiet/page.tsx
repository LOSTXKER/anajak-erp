"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { ArrowLeft, ExternalLink, Moon, Smartphone, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented";

import { useProtoFlag, useProtoVariant } from "../_kit/use-proto-variant";
import { QUIET_LEVELS, QuietStyle, type QuietLevel } from "./_levels";
import { QuietScreen } from "./_screen";

const VALUES = QUIET_LEVELS.map((level) => level.value) as readonly QuietLevel[];

const COPY: Record<
  QuietLevel,
  { name: string; keeps: string; summary: string; tradeoff: string }
> = {
  current: {
    name: "ตอนนี้",
    keeps: "กล่องสีอ่อนเต็มใบ + ไอคอนสี",
    summary:
      "ไอคอนทุกหัวข้ออยู่ในกล่องสีอ่อนขนาด 24–32px · ไอคอนหัวหน้าและการ์ดสรุปก็เป็นกล่องสีเช่นกัน — โผล่ 63 จุดทั่วเว็บ บวกหัวทุกหน้าและทุกแถวการ์ดสรุป",
    tradeoff:
      "แยกหมวดได้ไวที่สุด แต่พอหลายหมวดมาอยู่จอเดียวกัน (อย่างหน้าใบงานที่มีทั้งสินค้า การเงิน ผลิต ระบบ) กล่องสีจะเรียงกันเป็นแถบสีจนแย่งสายตากับเนื้อหา — ซึ่งคือสิ่งที่เบสบอกว่า “เด่นไป”",
  },
  soft: {
    name: "A · กล่องจางลง",
    keeps: "ยังมีกล่อง แต่จางลงเหลือ 40%",
    summary:
      "พื้นกล่องจางลงจนเกือบกลืนไปกับผิวการ์ด ส่วนไอคอนยังสีเดิมเป๊ะ — ยังมี “ที่จับสายตา” ตรงหัวข้อเหมือนเดิม แต่ไม่เป็นแถบสีทึบอีกต่อไป",
    tradeoff:
      "เสี่ยงน้อยที่สุด ไม่มีอะไรหายไป แต่ก็เปลี่ยนน้อยที่สุดด้วย — ถ้าสิ่งที่รบกวนตาคือ “มีกล่องเยอะเกินไป” ไม่ใช่ “กล่องสีแรงเกินไป” แบบนี้จะยังรู้สึกเหมือนเดิม · บนธีมมืดพื้นจางอยู่แล้ว จึงต่างจากตอนนี้น้อยมาก",
  },
  flat: {
    name: "B · ไม่มีกล่อง",
    keeps: "เหลือไอคอนสีลอย ไม่มีพื้น",
    summary:
      "ถอดพื้นกล่องออกทั้งเว็บ เหลือไอคอนสีนำหน้าหัวข้อเฉย ๆ · หัวข้อกลับไปเรียบเป็นบรรทัดเดียวเหมือนก่อนมีสี แต่ยังบอกหมวดได้จากสีไอคอน",
    tradeoff:
      "โล่งขึ้นชัดที่สุดโดยยังไม่เสียความหมาย แต่ไอคอนสีลอยบนพื้นขาวมีน้ำหนักน้อยลงมาก — บนจอทัชโรงงานที่แสงจ้า หรือคนที่แยกเขียว-ฟ้าไม่ค่อยออก จะเหลือแค่รูปไอคอนเป็นตัวบอก · กล่องเคยทำหน้าที่ “ปักหมุดตำแหน่งหัวข้อ” ให้ตากวาดหาได้เร็ว อันนั้นจะหายไป",
  },
  gray: {
    name: "C · เทาหมด",
    keeps: "สงวนสีไว้ให้สถานะกับปุ่มหลักเท่านั้น",
    summary:
      "ไอคอนหัวข้อกับตัวเลขกลับไปเป็นเทาทั้งหมด — สีที่เหลือบนจอมีแค่สามอย่าง: จุด/ตัวหนังสือสถานะ (แดง เหลือง เขียว น้ำเงิน) · ปุ่มหลักและสิ่งที่เลือกอยู่ · ตราแบรนด์",
    tradeoff:
      "คลีนที่สุด และทำให้ของที่ “ต้องรีบ” เด่นขึ้นทันทีเพราะไม่มีสีอื่นมาแข่ง — แต่เท่ากับถอยงาน “สีบอกหมวด” ทั้ง 4 เฟสที่เพิ่งทำเมื่อ 31 ส.ค. กลับไปที่เดิม · การแยกว่าหัวข้อไหนเป็นเรื่องเงิน/ผลิต/สินค้า จะเหลือแค่รูปไอคอนกับคำ",
  },
};

const NOTES = [
  "ทุกชิ้นในหน้านี้เป็น component ตัวจริง — หัวหน้า · การ์ดสรุป · หัวการ์ด · แถบชิปกรองและตารางของหน้าผลิตแบบ C ที่เพิ่งลงวันนี้ · เปลี่ยนแค่ “สีที่ทาลงไป” ไม่ได้วาดใหม่",
  "สีหมวดทั้งเว็บออกมาจากไฟล์เดียวคือ src/lib/visual-tone.ts — เคาะแบบไหนก็แก้ที่นั่นที่เดียว แล้วทั้ง 63 จุดเปลี่ยนตามพร้อมกัน ไม่ต้องไล่แก้ทีละหน้า",
  "หน้านี้จงใจเอาสี่หมวดมาอยู่จอเดียวกัน (ผลิต · สินค้า · การเงิน · ระบบ) เพราะ “เด่นไป” จะรู้สึกได้ตอนหลายสีมาเจอกัน ไม่ใช่ตอนดูหน้าที่มีสีเดียว",
  "สีที่แปลว่า “สถานะ” (แดง = มีปัญหา · เหลือง = ติดรอของ · เขียว = พร้อมส่ง) ไม่ถูกแตะในทุกแบบ — เป็นคนละภาษากับสีหมวด และเป็นสีที่ต้องดังอยู่แล้ว",
  "สลับโหมดมืดดูด้วย: พื้นกล่องสีอ่อนบนธีมมืดจางกว่าธีมสว่างอยู่แล้ว แบบ A จึงต่างจากตอนนี้น้อยมากบนธีมมืด",
  "ปุ่ม “ตัวเลขการ์ดสรุป” เป็นคนละเรื่องกับกล่องไอคอน — ตัวเลข 3xl สีเข้มดังกว่าไอคอนเล็กมาก จึงแยกให้เลือกได้เอง ใช้ร่วมกับระดับไหนก็ได้ (ที่ระดับ C ตัวเลขเป็นเทาอยู่แล้ว ปุ่มนี้จึงไม่มีผลเพิ่ม)",
] as const;

const OUT_OF_SCOPE = [
  "เมนูซ้ายไม่มีสีอยู่แล้ว (เบสสั่งไว้ 31 ส.ค.) และไม่ถูกแตะในทุกแบบ",
  "เอกสารสั่งพิมพ์กับหน้าที่ลูกค้าเห็น มีกติกาสีของตัวเอง ไม่เกี่ยวกับสีหมวด",
  "หน้าลองนี้ทับสีด้วย CSS เพื่อให้เห็นภาพ — ตอนลงของจริงจะแก้ที่ visual-tone.ts ให้เป็นสีจริง ไม่ใช่ทับ",
  "ยังไม่ได้แตะขนาด/ระยะ/ฟอนต์ — โจทย์รอบนี้คือ “สีดังไป” อย่างเดียว",
] as const;

const subscribeNever = () => () => {};
const getTrue = () => true;
const getFalse = () => false;

export default function QuietProtoPage() {
  const [level, setLevel] = useProtoVariant<QuietLevel>("v", VALUES, "current");
  const [plainNumbers, togglePlainNumbers] = useProtoFlag("plain");
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(subscribeNever, getTrue, getFalse);
  const isDark = mounted && resolvedTheme === "dark";
  const copy = COPY[level];
  const src = `/proto/quiet/view?v=${level}&plain=${plainNumbers ? "1" : "0"}`;

  return (
    <main className="min-h-screen bg-surface-muted px-4 py-8 text-strong sm:px-6 lg:px-10">
      <QuietStyle />
      <div className="mx-auto max-w-[1500px]">
        <Link
          href="/proto"
          className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-secondary"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          หน้าลองทั้งหมด
        </Link>

        <h1 className="mt-3 text-2xl font-semibold sm:text-3xl">
          สีบอกหมวดควรเบาลงแค่ไหน
        </h1>
        <p className="mt-2 max-w-4xl text-sm text-secondary">
          เบสบอกว่า “ทั้งเว็บมีสีมันก็ดี แต่มันดูเด่นไป อยากให้คลีนกว่านี้” — สามแบบข้างล่างคือ
          บันไดสามขั้นของการหรี่สีลง ตั้งแต่แค่จางลง จนถึงถอดสีหมวดออกหมดแล้วเก็บสีไว้ให้สถานะอย่างเดียว
          กดสลับดูทีละแบบ แล้วบอกมาว่าเอาขั้นไหน
        </p>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="overflow-x-auto pb-1">
              <SegmentedControl
                options={QUIET_LEVELS.map((option) => ({ ...option }))}
                value={level}
                onChange={setLevel}
                aria-label="เลือกระดับความเบาของสี"
                className="min-w-max"
              />
            </div>
            <Button variant="outline" size="sm" onClick={togglePlainNumbers}>
              {plainNumbers ? "ตัวเลขการ์ดสรุป: สีปกติ" : "ตัวเลขการ์ดสรุป: สีหมวด"}
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

        <section className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="border-l-2 border-blue-600 pl-4 dark:border-blue-400">
            <p className="text-2xs font-medium uppercase tracking-wide text-muted">
              เก็บอะไรไว้: {copy.keeps}
            </p>
            <h2 className="mt-1 text-lg font-semibold">{copy.name}</h2>
            <p className="mt-1.5 text-sm text-secondary">{copy.summary}</p>
            <p className="mt-2 text-sm text-amber-800 dark:text-amber-200">
              <span className="font-medium">ข้อแลก:</span> {copy.tradeoff}
            </p>
          </div>
          <div className="card-surface rounded-2xl p-4 text-sm">
            <p className="font-medium">สิ่งที่ต้องรู้ก่อนตัดสิน</p>
            <ul className="mt-2 space-y-1.5 text-xs text-secondary">
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

        <section className="mt-8">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-2xs font-medium uppercase tracking-wide text-muted">
              หนึ่งหน้าจอที่มีสีครบทุกหมวด
            </p>
            <span className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() =>
                  window.open(src, "proto-mobile", "width=390,height=820,noopener")
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
          <div
            data-quiet={level}
            data-nums={plainNumbers ? "plain" : undefined}
            className="overflow-hidden rounded-2xl bg-bg px-4 py-6 ring-1 ring-inset ring-border sm:px-6 lg:px-8"
          >
            <QuietScreen />
          </div>
        </section>

        <section className="card-surface mt-10 rounded-2xl p-5">
          <h2 className="text-sm font-semibold">หน้าลองนี้ยังไม่ครอบอะไรบ้าง</h2>
          <ul className="mt-2 space-y-1.5 text-xs text-secondary">
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
