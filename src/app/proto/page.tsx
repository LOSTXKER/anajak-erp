import Link from "next/link";
import { PROTOS, type ProtoStatus } from "./_registry";

const ORDER: ProtoStatus[] = ["รอเคาะ", "เคาะแล้ว", "เก็บอ้างอิง", "พับ"];
const TONE: Record<ProtoStatus, string> = {
  รอเคาะ: "text-blue-700 ring-blue-600/30 dark:text-blue-300 dark:ring-blue-400/30",
  เคาะแล้ว: "text-green-700 ring-green-600/30 dark:text-green-300 dark:ring-green-400/30",
  เก็บอ้างอิง: "text-secondary ring-border",
  พับ: "text-muted ring-border line-through",
};

export default function ProtoIndexPage() {
  const groups = ORDER.map(
    (status) => [status, PROTOS.filter((p) => p.status === status)] as const,
  ).filter(([, list]) => list.length > 0);

  return (
    <main className="min-h-screen bg-surface-muted px-4 py-10 text-strong sm:px-6 lg:px-10">
      <div className="mx-auto max-w-[900px]">
        <h1 className="text-2xl font-semibold">หน้าลองทั้งหมด</h1>
        <p className="mt-2 text-sm text-secondary">
          หน้าเทียบทางเลือกก่อนแก้ของจริง — ชื่อลูกค้า ตัวเลข และยอดเงินในนี้เป็นของปลอมทั้งหมด
          ไม่ได้ต่อฐานข้อมูลจริง
        </p>

        {groups.map(([status, list]) => (
          <section key={status} className="mt-8">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
              {status}
            </p>
            <ul className="space-y-2">
              {list.map((proto) => (
                <li key={proto.slug}>
                  <Link
                    href={`/proto/${proto.slug}`}
                    className="card-surface card-surface-hover flex items-start gap-3 rounded-2xl p-4"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{proto.title}</span>
                      <span className="mt-0.5 block text-sm text-secondary">
                        {proto.question}
                      </span>
                      {proto.verdict && (
                        <span className="mt-1 block text-xs text-muted">→ {proto.verdict}</span>
                      )}
                    </span>
                    <span className="shrink-0 text-right">
                      <span
                        className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${TONE[proto.status]}`}
                      >
                        {proto.status}
                      </span>
                      <span className="mt-1 block text-xs tabular-nums text-muted">
                        {proto.date}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </main>
  );
}
