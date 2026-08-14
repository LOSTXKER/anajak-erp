import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

interface OrderCatalogAlertProps {
  hasError: boolean;
  onRetry: () => void;
}

/** สถานะโหลดแค็ตตาล็อกกลางของฟอร์ม create/edit — ห้ามปล่อยให้ตัวเลือกหายเงียบ */
export function OrderCatalogAlert({
  hasError,
  onRetry,
}: OrderCatalogAlertProps) {
  if (!hasError) return null;

  return (
    <Alert variant="warning">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm">
          โหลดแค็ตตาล็อกลาย/ส่วนเสริม/ค่าใช้จ่ายไม่สำเร็จ — ตัวเลือกจากแค็ตตาล็อกจะไม่ขึ้น
        </span>
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>
          ลองใหม่
        </Button>
      </div>
    </Alert>
  );
}
