"use client";
import { Suspense, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { useProtoFlag, useProtoVariant } from "./use-proto-variant";

export type ProtoVariant<K extends string> = { key: K; label: string; tradeoff?: string };
type Props<K extends string> = {
  title: string;                        // คำถามที่ต้องเคาะ 1 ประโยค
  variants: readonly ProtoVariant<K>[]; // ตัวแรก = ปัจจุบัน เสมอ · label สั้น ("A · ปุ่มอยู่กับขั้น") · tradeoff ≤ 1 บรรทัด
  render: (variant: K) => ReactNode;    // component จริง รับ variant — ห้ามวาดใหม่
  controls?: ReactNode;                 // ปุ่มสลับสถานะขอบ (useProtoFlag) ถ้ามี
  mobile?: { width: number; height: number };
  desktopHeight?: number;
};
const ALL = "all" as const;

/** ครอบ Suspense ให้เอง — useSearchParams ต้องมี boundary ตอน prerender */
export function ProtoCompare<K extends string>(props: Props<K>) {
  return <Suspense fallback={null}><Compare {...props} /></Suspense>;
}

function Compare<K extends string>({ title, variants, render, controls, mobile = { width: 390, height: 780 }, desktopHeight = 720 }: Props<K>) {
  const keys = variants.map((v) => v.key);
  const [focus, setFocus] = useProtoVariant<K | typeof ALL>("v", [ALL, ...keys], ALL);
  const [isFrame] = useProtoFlag("frame");
  const search = useSearchParams().toString();

  // โหมดกรอบ (iframe เรียก / proto-shots ถ่าย): เรนเดอร์เฉพาะทางที่ขอ เต็ม viewport จริง
  if (isFrame) {
    const key = focus === ALL ? keys[0] : focus;
    return <div data-proto-preview data-proto-key={key}>{render(key)}</div>;
  }
  const frameSrc = (key: K) => { const q = new URLSearchParams(search); q.set("v", key); q.set("frame", "1"); return `?${q}`; };
  const shown = focus === ALL ? variants : variants.filter((v) => v.key === focus);

  return (
    <main data-proto-variants={keys.join(",")} className="min-h-screen bg-background px-4 py-6 text-foreground">
      <h1 className="text-lg font-semibold">{title}</h1>
      <nav aria-label="เลือกทาง" className="mt-3 flex flex-wrap items-center gap-2">
        <Chip active={focus === ALL} onClick={() => setFocus(ALL)}>ทั้งหมด</Chip>
        {variants.map((v) => <Chip key={v.key} active={focus === v.key} onClick={() => setFocus(v.key)}>{v.label}</Chip>)}
        {controls}
      </nav>
      <section aria-label="มือถือ" className="mt-5 flex snap-x gap-4 overflow-x-auto pb-2">
        {shown.map((v) => (
          <figure key={v.key} className="shrink-0 snap-start" style={{ width: mobile.width }}>
            <iframe title={`${v.label} · มือถือ`} src={frameSrc(v.key)} width={mobile.width} height={mobile.height} className="rounded-[1.5rem] border bg-background" />
            <Caption v={v} />
          </figure>
        ))}
      </section>
      <section aria-label="คอม" className="mt-6 hidden space-y-6 lg:block">
        {shown.map((v) => (
          <figure key={v.key}>
            <iframe title={`${v.label} · คอม`} src={frameSrc(v.key)} width="100%" height={desktopHeight} className="rounded-xl border bg-background" />
            <Caption v={v} />
          </figure>
        ))}
      </section>
    </main>
  );
}

function Caption({ v }: { v: ProtoVariant<string> }) {
  return <figcaption className="mt-1.5 text-sm"><span className="font-medium">{v.label}</span>{v.tradeoff && <span className="text-muted-foreground"> · {v.tradeoff}</span>}</figcaption>;
}
function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return <button type="button" aria-pressed={active} onClick={onClick} className={`rounded-full border px-3 py-1 text-sm ${active ? "bg-foreground text-background" : "hover:bg-muted"}`}>{children}</button>;
}
