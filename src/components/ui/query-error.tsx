import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "./button";

interface QueryErrorProps {
  message?: string;
  onRetry?: () => void;
}

export function QueryError({
  message = "เกิดข้อผิดพลาดในการโหลดข้อมูล",
  onRetry,
}: QueryErrorProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <AlertTriangle className="h-10 w-10 text-red-300 dark:text-red-600" />
      <p className="mt-3 text-sm text-red-500">{message}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="mt-4 gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" />
          ลองใหม่
        </Button>
      )}
    </div>
  );
}
