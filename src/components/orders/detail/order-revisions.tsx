import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";
import { Clock } from "lucide-react";

interface Revision {
  id: string;
  description: string;
  changedBy: string;
  changeType: string;
  createdAt: Date | string;
}

interface OrderRevisionsProps {
  revisions: Revision[];
}

export function OrderRevisions({ revisions }: OrderRevisionsProps) {
  if (!revisions || revisions.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Clock className="h-4 w-4" />
          ประวัติการเปลี่ยนแปลง
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {revisions.map((rev) => (
              <div
                key={rev.id}
                className="flex gap-3 border-l-2 border-slate-200 pl-4 dark:border-slate-700"
              >
                <div className="flex-1">
                  <p className="text-sm text-slate-900 dark:text-white">
                    {rev.description}
                  </p>
                  <p className="text-xs text-slate-400">
                    {rev.changedBy} &mdash; {formatDateTime(rev.createdAt)}
                  </p>
                </div>
                {rev.changeType && (
                  <Badge variant="secondary">{rev.changeType}</Badge>
                )}
              </div>
            ),
          )}
        </div>
      </CardContent>
    </Card>
  );
}
