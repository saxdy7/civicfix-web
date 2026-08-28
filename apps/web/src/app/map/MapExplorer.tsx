"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";

import { Card } from "@civicfix/ui-web";

import { IssueMap } from "@/components/IssueMap";
import { StatusPill } from "@/components/StatusPill";
import { CATEGORY_LABEL } from "@/lib/status";
import type { Issue, IssueCategory } from "@/lib/types";

import styles from "./page.module.css";

const FILTERS: { key: IssueCategory | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pothole", label: "Potholes" },
  { key: "garbage", label: "Garbage" },
  { key: "streetlight", label: "Streetlights" },
  { key: "other", label: "Other" },
];

export function MapExplorer({ issues }: { issues: Issue[] }) {
  const [filter, setFilter] = useState<IssueCategory | "all">("all");
  const [selectedId, setSelectedId] = useState<string | undefined>();

  const filtered = useMemo(
    () => (filter === "all" ? issues : issues.filter((issue) => issue.category === filter)),
    [filter, issues],
  );

  const handleSelect = useCallback((issueId: string) => setSelectedId(issueId), []);

  return (
    <>
      <IssueMap issues={filtered} onSelect={handleSelect} selectedId={selectedId} />

      <div className={styles.filters}>
        {FILTERS.map((item) => (
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
