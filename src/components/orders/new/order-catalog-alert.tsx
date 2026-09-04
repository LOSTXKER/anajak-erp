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
    <Alert
      variant="warning"
      title="โหลดแค็ตตาล็อกไม่สำเร็จ"
      action={
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>
          ลองใหม่
        </Button>
      }
    >
      ลาย/ส่วนเสริม/ค่าใช้จ่ายจากแค็ตตาล็อกจะไม่ขึ้นเป็นตัวเลือก
    </Alert>
  );
}
