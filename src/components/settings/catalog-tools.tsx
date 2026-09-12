import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/search-input";

/** เครื่องมือหาข้อมูลในทะเบียนที่โหลดมาแล้ว ไม่เปลี่ยน query หรือสิทธิ์ของแต่ละหน้า */
export function CatalogTools({ search, onSearch, count, total, label, loading = false, tableScrollHint = false }: {
  search: string; onSearch: (value: string) => void; count: number; total: number; label: string; loading?: boolean; tableScrollHint?: boolean;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <SearchInput value={search} onChange={(event) => onSearch(event.target.value)} aria-label={`ค้นหา${label}ในรายการนี้`} placeholder={`ค้นหา${label}`} containerClassName="w-full sm:max-w-sm" />
      <p className="text-sm text-secondary" aria-live="polite">{loading ? "กำลังโหลดรายการ…" : `${count.toLocaleString("th-TH")}${search ? ` จาก ${total.toLocaleString("th-TH")}` : ""} รายการ`}</p>
      {tableScrollHint && !loading && count > 0 && <p className="w-full text-xs text-secondary sm:hidden">เลื่อนตารางซ้าย–ขวา เพื่อดูข้อมูลและปุ่มจัดการ →</p>}
      {search ? <Button size="sm" variant="ghost" onClick={() => onSearch("")}>ล้างคำค้น</Button> : null}
    </div>
  );
}

export function CatalogFeedback({ pending, error }: { pending?: boolean; error?: string | null }) {
  if (pending) return <p role="status" className="mt-2 text-sm text-secondary">กำลังบันทึก…</p>;
  if (error) return <p role="alert" className="mt-2 max-w-sm whitespace-normal text-sm text-red-700 dark:text-red-300">{error}</p>;
  return null;
}
