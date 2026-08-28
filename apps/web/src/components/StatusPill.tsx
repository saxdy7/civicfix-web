import { Badge } from "@civicfix/ui-web";

import { STATUS_SHORT_LABEL, STATUS_TONE } from "@/lib/status";
import type { IssueStatus } from "@/lib/types";

export function StatusPill({ status }: { status: IssueStatus }) {
  return <Badge tone={STATUS_TONE[status]}>{STATUS_SHORT_LABEL[status]}</Badge>;
}
