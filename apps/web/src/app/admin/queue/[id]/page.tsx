"use client";

import { notFound, useParams } from "next/navigation";
import { useQuery } from "convex/react";

import { Card } from "@civicfix/ui-web";

import { IssueChat } from "@/components/IssueChat";
import { StatusPill } from "@/components/StatusPill";
import { maskReporter } from "@/lib/admin-mappers";
import { CATEGORY_LABEL, SEVERITY_LABEL } from "@/lib/status";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";

import styles from "../../admin.module.css";
import { EvidencePanel } from "./EvidencePanel";
import { ResolutionPanel } from "./ResolutionPanel";
import { TriagePanel } from "./TriagePanel";

export default function IssueTriagePage() {
  const { id } = useParams<{ id: string }>();
  const issue = useQuery(api.issues.getById, { issueId: id as Id<"issues"> });

  if (issue === undefined) return null;
  if (!issue) notFound();

  return (
    <div>
      <div className={styles.pageHeader} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 className={styles.title}>{issue.trackingId}</h1>
          <p className={styles.subtitle}>
            {CATEGORY_LABEL[issue.category]} · {SEVERITY_LABEL[issue.severity]} severity · {issue.neighborhood ?? "Unspecified"}
          </p>
        </div>
        <StatusPill status={issue.status} />
      </div>

      <Card style={{ marginBottom: "var(--space-4)" }}>
        <h2 className={styles.sectionTitle}>Report</h2>
        <p style={{ margin: 0 }}>{issue.description}</p>
        <p style={{ margin: "var(--space-2) 0 0", fontSize: "var(--font-size-xs)", color: "var(--color-muted-foreground)" }}>
          Reported by {maskReporter(issue.reporterId)} on {new Date(issue.createdAt).toLocaleString()}
        </p>
      </Card>

      <TriagePanel issue={issue} />

      <div style={{ marginTop: "var(--space-4)" }}>
        <EvidencePanel issue={issue} />
      </div>

      <div style={{ marginTop: "var(--space-4)" }}>
        <ResolutionPanel issue={issue} />
      </div>

      <div style={{ marginTop: "var(--space-4)" }}>
        <IssueChat issueId={issue._id} senderRole="staff" />
      </div>
    </div>
  );
}
