import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ImageIcon } from "lucide-react";

interface OrderReferenceImagesProps {
  attachments: any[] | undefined; // eslint-disable-line @typescript-eslint/no-explicit-any
}

const POSITION_LABELS: Record<string, string> = {
  FRONT: "หน้า", BACK: "หลัง", SLEEVE_L: "แขนซ้าย", SLEEVE_R: "แขนขวา",
  COLLAR: "ปก", POCKET: "กระเป๋า", OTHER: "อื่นๆ",
};

export function OrderReferenceImages({ attachments }: OrderReferenceImagesProps) {
  const refImages = attachments?.filter(a => a.category === "REFERENCE_IMAGE") ?? [];
  if (refImages.length === 0) return null;

  const generalImages = refImages.filter(a => !a.printPosition);
  const positionGroups = refImages.reduce<Record<string, typeof refImages>>((acc, a) => {
    if (a.printPosition) {
      if (!acc[a.printPosition]) acc[a.printPosition] = [];
      acc[a.printPosition].push(a);
    }
    return acc;
  }, {});

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ImageIcon className="h-4 w-4" />
          ภาพอ้างอิง ({refImages.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* General images (no position) */}
        {generalImages.length > 0 && (
          <div>
            {Object.keys(positionGroups).length > 0 && (
              <p className="mb-2 text-xs font-medium text-slate-500">ทั่วไป</p>
            )}
            <div className="flex flex-wrap gap-3">
              {generalImages.map((att) => (
                <a key={att.id} href={att.fileUrl} target="_blank" rel="noopener noreferrer" className="group relative">
                  {att.fileUrl.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                    <img src={att.fileUrl} alt={att.fileName} className="h-28 w-28 rounded-lg border border-slate-200 object-cover transition-shadow hover:shadow-md dark:border-slate-700" />
                  ) : (
                    <div className="flex h-28 w-28 flex-col items-center justify-center rounded-lg border border-slate-200 bg-slate-50 transition-shadow hover:shadow-md dark:border-slate-700 dark:bg-slate-800">
                      <ImageIcon className="h-8 w-8 text-slate-300 dark:text-slate-600" />
                      <span className="mt-1 text-[10px] text-slate-400">{att.fileName.split(".").pop()?.toUpperCase()}</span>
                    </div>
                  )}
                  <p className="mt-1 max-w-[7rem] truncate text-[10px] text-slate-400">{att.fileName}</p>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Grouped by position */}
        {Object.entries(positionGroups).map(([pos, imgs]) => (
          <div key={pos}>
            <p className="mb-2 text-xs font-medium text-slate-500">
              <Badge variant="secondary" className="text-[10px]">{POSITION_LABELS[pos] || pos}</Badge>
            </p>
            <div className="flex flex-wrap gap-3">
              {imgs.map((att) => (
                <a key={att.id} href={att.fileUrl} target="_blank" rel="noopener noreferrer" className="group relative">
                  {att.fileUrl.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                    <img src={att.fileUrl} alt={att.fileName} className="h-28 w-28 rounded-lg border border-slate-200 object-cover transition-shadow hover:shadow-md dark:border-slate-700" />
                  ) : (
                    <div className="flex h-28 w-28 flex-col items-center justify-center rounded-lg border border-slate-200 bg-slate-50 transition-shadow hover:shadow-md dark:border-slate-700 dark:bg-slate-800">
                      <ImageIcon className="h-8 w-8 text-slate-300 dark:text-slate-600" />
                      <span className="mt-1 text-[10px] text-slate-400">{att.fileName.split(".").pop()?.toUpperCase()}</span>
                    </div>
                  )}
                  <p className="mt-1 max-w-[7rem] truncate text-[10px] text-slate-400">{att.fileName}</p>
                </a>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
