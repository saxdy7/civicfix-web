"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";

import { Card } from "@civicfix/ui-web";

import { IssueMap } from "@/components/IssueMap";
import { StatusPill } from "@/components/StatusPill";
import { CATEGORY_LABEL, SEVERITY_LABEL, STATUS_SHORT_LABEL } from "@/lib/status";
import type { Issue, IssueCategory, IssueSeverity, IssueStatus } from "@/lib/types";

import styles from "./page.module.css";

const CATEGORY_FILTERS: { key: IssueCategory | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pothole", label: "Potholes" },
  { key: "garbage", label: "Garbage" },
  { key: "streetlight", label: "Streetlights" },
  { key: "other", label: "Other" },
];

const SEVERITY_FILTERS: (IssueSeverity | "all")[] = ["all", "low", "medium", "high", "critical"];
const STATUS_FILTERS: (IssueStatus | "all")[] = [
  "all",
  "reported",
  "triaged",
  "assigned",
  "in_progress",
  "pending_verification",
  "resolved",
  "reopened",
];

export function MapExplorer({ issues }: { issues: Issue[] }) {
  const [filter, setFilter] = useState<IssueCategory | "all">("all");
  const [severityFilter, setSeverityFilter] = useState<IssueSeverity | "all">("all");
  const [statusFilter, setStatusFilter] = useState<IssueStatus | "all">("all");
  const [selectedId, setSelectedId] = useState<string | undefined>();

  const filtered = useMemo(
    () =>
      issues.filter(
        (issue) =>
          (filter === "all" || issue.category === filter) &&
          (severityFilter === "all" || issue.severity === severityFilter) &&
          (statusFilter === "all" || issue.status === statusFilter),
      ),
    [filter, severityFilter, statusFilter, issues],
  );

  const handleSelect = useCallback((issueId: string) => setSelectedId(issueId), []);

  return (
    <>
      <IssueMap issues={filtered} onSelect={handleSelect} selectedId={selectedId} />

      <div className={styles.filters}>
        {CATEGORY_FILTERS.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`${styles.filterChip} ${filter === item.key ? styles.filterChipActive : ""}`}
            onClick={() => setFilter(item.key)}
            aria-pressed={filter === item.key}
          >
            {item.label}
          </button>
        ))}
        <span className={styles.count}>
          {filtered.length} {filtered.length === 1 ? "report" : "reports"}
        </span>
      </div>

      <div className={styles.filters}>
        <select
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value as IssueSeverity | "all")}
          className={styles.filterChip}
          aria-label="Filter by severity"
        >
          <option value="all">Any severity</option>
          {SEVERITY_FILTERS.filter((s) => s !== "all").map((s) => (
            <option key={s} value={s}>
              {SEVERITY_LABEL[s]} severity
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as IssueStatus | "all")}
          className={styles.filterChip}
          aria-label="Filter by status"
        >
          <option value="all">Any status</option>
          {STATUS_FILTERS.filter((s) => s !== "all").map((s) => (
            <option key={s} value={s}>
              {STATUS_SHORT_LABEL[s]}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <p className={styles.emptyState}>
            No reports in this category yet. Try another filter.
          </p>
        </Card>
      ) : (
        <div className={styles.list}>
          {filtered.map((issue) => (
            <Link key={issue.id} href={`/issues/${issue.id}`} className={styles.issueLink}>
              <Card
                className={`${styles.issueCard} ${issue.id === selectedId ? styles.issueCardSelected : ""}`}
              >
                <div className={styles.issueTop}>
                  <h3 className={styles.issueTitle}>
                    {CATEGORY_LABEL[issue.category]} · {issue.trackingId}
                  </h3>
                  <StatusPill status={issue.status} />
                </div>
                <p className={styles.issueBody}>{issue.description}</p>
                <p className={styles.issueMeta}>
                  {issue.neighborhood} · Reported {new Date(issue.createdAt).toLocaleDateString()}
                </p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
