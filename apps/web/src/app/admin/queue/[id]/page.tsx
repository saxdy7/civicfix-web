import { notFound } from "next/navigation";

import { Card } from "@civicfix/ui-web";

import { IssueChat } from "@/components/IssueChat";
import { StatusPill } from "@/components/StatusPill";
import { mapIssueEventRow, mapIssueRow, type IssueRow } from "@/lib/admin-mappers";
import { createServerSupabase, getSessionProfile } from "@/lib/supabase-server";
import { CATEGORY_LABEL, SEVERITY_LABEL } from "@/lib/status";
import type { IssueCategory } from "@/lib/types";

import styles from "../../admin.module.css";
import { EvidencePanel, type EvidenceRecord } from "./EvidencePanel";
import { ResolutionPanel } from "./ResolutionPanel";
import { TriagePanel } from "./TriagePanel";

const EVIDENCE_SIGNED_URL_TTL_SECONDS = 60 * 10;

interface AiAssessmentRow {
  provider: string;
  model: string;
  confidence: number | null;
  output: unknown;
}

function readSuggestedCategory(row: AiAssessmentRow | null): { category: IssueCategory; confidence: number } | null {
  if (!row) return null;
  const output = row.output as Record<string, unknown> | null;
  const category = output && typeof output === "object" ? output["category"] : undefined;
  const validCategories: IssueCategory[] = ["pothole", "garbage", "streetlight", "other"];
  if (typeof category === "string" && (validCategories as string[]).includes(category)) {
    return { category: category as IssueCategory, confidence: row.confidence ?? 0 };
  }
  return null;
}

export default async function IssueTriagePage({ params }: PageProps<"/admin/queue/[id]">) {
  const { id } = await params;
  const supabase = await createServerSupabase();
  const session = await getSessionProfile();

  if (!supabase) {
    return (
      <Card>
        <p className={styles.emptyState}>
          Supabase is not configured — connect it to view and triage live reports.
        </p>
      </Card>
    );
  }

  const { data: issueRow } = await supabase
    .from("issues")
    .select(
      "id, tracking_id, category, status, severity, priority, description, neighborhood, reporter_id, department_id, duplicate_of_issue_id, location, created_at, updated_at, departments(id, name)",
    )
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!issueRow) notFound();

  const [eventsRes, evidenceRes, assignmentsRes, aiAssessmentRes, departmentsRes, workerRolesRes] = await Promise.all([
    supabase
      .from("issue_events")
      .select("id, status, note, created_at")
      .eq("issue_id", id)
      .order("created_at", { ascending: true }),
    supabase
      .from("resolution_evidence")
      .select("id, before_media_id, after_media_id, note, submitted_at, verified_at")
      .eq("issue_id", id)
      .order("submitted_at", { ascending: false }),
    supabase
      .from("assignments")
      .select("id, worker_id, due_at, accepted_at, completed_at, created_at")
      .eq("issue_id", id)
      .order("created_at", { ascending: false })
      .limit(1),
    supabase
      .from("ai_assessments")
      .select("provider, model, confidence, output")
      .eq("issue_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("departments").select("id, name").order("name", { ascending: true }),
    supabase.from("user_roles").select("user_id").eq("role", "field_worker"),
  ]);

  const events = (eventsRes.data ?? []).map(mapIssueEventRow);
  const issue = mapIssueRow(issueRow as unknown as IssueRow, events);

  const evidenceRows = (evidenceRes.data ?? []) as {
    id: string;
    before_media_id: string | null;
    after_media_id: string | null;
    note: string | null;
    submitted_at: string;
    verified_at: string | null;
  }[];
  const hasVerifiedEvidence = evidenceRows.some((row) => row.verified_at !== null);
  const latestEvidenceRow = evidenceRows[0] ?? null;

  let latestEvidence: EvidenceRecord | null = null;
  if (latestEvidenceRow) {
    const mediaIds = [latestEvidenceRow.before_media_id, latestEvidenceRow.after_media_id].filter(
      (mid): mid is string => Boolean(mid),
    );
    const urlByMediaId = new Map<string, string>();
    if (mediaIds.length > 0) {
      const { data: mediaRows } = await supabase.from("issue_media").select("id, storage_key").in("id", mediaIds);
      await Promise.all(
        (mediaRows ?? []).map(async (row) => {
          const { data: signed } = await supabase.storage
            .from("issue-media")
            .createSignedUrl(row.storage_key, EVIDENCE_SIGNED_URL_TTL_SECONDS);
          if (signed?.signedUrl) urlByMediaId.set(row.id, signed.signedUrl);
        }),
      );
    }
    latestEvidence = {
      id: latestEvidenceRow.id,
      beforeUrl: latestEvidenceRow.before_media_id ? (urlByMediaId.get(latestEvidenceRow.before_media_id) ?? null) : null,
      afterUrl: latestEvidenceRow.after_media_id ? (urlByMediaId.get(latestEvidenceRow.after_media_id) ?? null) : null,
      note: latestEvidenceRow.note,
      submittedAt: latestEvidenceRow.submitted_at,
      verifiedAt: latestEvidenceRow.verified_at,
    };
  }

  const assignmentRow = (assignmentsRes.data ?? [])[0] as
    | { id: string; worker_id: string | null; due_at: string | null; accepted_at: string | null; completed_at: string | null }
    | undefined;

  let workerName: string | null = null;
  if (assignmentRow?.worker_id) {
    const { data: workerProfile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", assignmentRow.worker_id)
      .maybeSingle();
    workerName = workerProfile?.full_name ?? null;
  }

  let duplicateIssue: { id: string; trackingId: string; description: string } | null = null;
  if (issueRow.duplicate_of_issue_id) {
    const { data: dupRow } = await supabase
      .from("issues")
      .select("id, tracking_id, description")
      .eq("id", issueRow.duplicate_of_issue_id)
      .maybeSingle();
    if (dupRow) {
      duplicateIssue = { id: dupRow.id, trackingId: dupRow.tracking_id, description: dupRow.description };
    }
  }

  const aiAssessment = readSuggestedCategory((aiAssessmentRes.data ?? null) as AiAssessmentRow | null);
  const departments = (departmentsRes.data ?? []) as { id: string; name: string }[];

  const workerIds = (workerRolesRes.data ?? []).map((r) => r.user_id as string);
  let workers: { id: string; name: string }[] = [];
  if (workerIds.length > 0) {
    const { data: workerProfiles } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", workerIds);
    workers = (workerProfiles ?? []).map((p) => ({
      id: p.id,
      name: p.full_name || p.email || "Unnamed worker",
    }));
  }

  return (
    <div>
      <div className={styles.pageHeader} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 className={styles.title}>{issue.trackingId}</h1>
          <p className={styles.subtitle}>
            {CATEGORY_LABEL[issue.category]} · {SEVERITY_LABEL[issue.severity]} severity · {issue.neighborhood}
          </p>
        </div>
        <StatusPill status={issue.status} />
      </div>

      <Card style={{ marginBottom: "var(--space-4)" }}>
        <h2 className={styles.sectionTitle}>Report</h2>
        <p style={{ margin: 0 }}>{issue.description}</p>
        <p style={{ margin: "var(--space-2) 0 0", fontSize: "var(--font-size-xs)", color: "var(--color-muted-foreground)" }}>
          Reported by {issue.reporterMasked} on {new Date(issue.createdAt).toLocaleString()}
        </p>
      </Card>

      <TriagePanel
        issue={issue}
        duplicateIssue={duplicateIssue}
        aiAssessment={aiAssessment}
        departments={departments}
        workers={workers}
        assignedWorkerId={assignmentRow?.worker_id ?? null}
      />

      {session ? (
        <div style={{ marginTop: "var(--space-4)" }}>
          <EvidencePanel
            issueId={issue.id}
            issueStatus={issue.status}
            assignmentId={assignmentRow?.id ?? null}
            currentUserId={session.userId}
            evidence={latestEvidence}
          />
        </div>
      ) : null}

      <div style={{ marginTop: "var(--space-4)" }}>
        <ResolutionPanel
          issue={issue}
          hasVerifiedEvidence={hasVerifiedEvidence}
          assignmentDueAt={assignmentRow?.due_at ?? null}
          workerName={workerName}
        />
      </div>

      {session ? (
        <div style={{ marginTop: "var(--space-4)" }}>
          <IssueChat issueId={issue.id} currentUserId={session.userId} senderRole="staff" />
        </div>
      ) : null}
    </div>
  );
}
