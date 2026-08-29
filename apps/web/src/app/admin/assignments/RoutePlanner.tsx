"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Badge, Button, Card } from "@civicfix/ui-web";
import { CATEGORY_LABEL, SEVERITY_LABEL } from "@/lib/status";
import type { Doc } from "@convex/_generated/dataModel";
import styles from "../admin.module.css";

interface RouteTask {
  assignmentId: string;
  workerId: string;
  workerName: string;
  issue: Doc<"issues">;
  dueAt?: number;
}

interface RoutePlannerProps {
  tasks: RouteTask[];
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function RoutePlanner({ tasks }: RoutePlannerProps) {
  const [selectedWorkerId, setSelectedWorkerId] = useState<string>("all");

  const workers = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of tasks) {
      map.set(t.workerId, t.workerName);
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    if (selectedWorkerId === "all") return tasks;
    return tasks.filter((t) => t.workerId === selectedWorkerId);
  }, [tasks, selectedWorkerId]);

  // Optimize route sequence:
  // 1. Prioritize Critical/Emergency tasks first.
  // 2. Apply greedy nearest-neighbor TSP heuristic for spatial proximity.
  const optimizedSequence = useMemo(() => {
    if (filteredTasks.length === 0) return [];

    const remaining = [...filteredTasks];
    const ordered: { task: RouteTask; legKm: number; stepNumber: number }[] = [];

    // Sort initial pool by severity weight (critical > high > medium > low)
    const severityWeight: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
    remaining.sort((a, b) => (severityWeight[b.issue.severity] || 0) - (severityWeight[a.issue.severity] || 0));

    // Start with the highest priority task
    let current = remaining.shift()!;
    ordered.push({ task: current, legKm: 0, stepNumber: 1 });

    // Sequentially find the nearest remaining task (with severity tie-breaker)
    while (remaining.length > 0) {
      let nearestIdx = 0;
      let minCost = Infinity;

      for (let i = 0; i < remaining.length; i++) {
        const candidate = remaining[i];
        const distKm = haversineKm(
          current.issue.latitude,
          current.issue.longitude,
          candidate.issue.latitude,
          candidate.issue.longitude
        );
        // Cost balances distance with severity priority
        const urgencyBonus = (severityWeight[candidate.issue.severity] || 1) * 1.5;
        const cost = distKm - urgencyBonus;

        if (cost < minCost) {
          minCost = cost;
          nearestIdx = i;
        }
      }

      const next = remaining.splice(nearestIdx, 1)[0];
      const legDist = haversineKm(
        current.issue.latitude,
        current.issue.longitude,
        next.issue.latitude,
        next.issue.longitude
      );

      ordered.push({ task: next, legKm: legDist, stepNumber: ordered.length + 1 });
      current = next;
    }

    return ordered;
  }, [filteredTasks]);

  const totalRouteKm = useMemo(() => {
    return optimizedSequence.reduce((acc, curr) => acc + curr.legKm, 0);
  }, [optimizedSequence]);

  const multiStopMapsUrl = useMemo(() => {
    if (optimizedSequence.length === 0) return "#";
    const waypoints = optimizedSequence
      .map((s) => `${s.task.issue.latitude},${s.task.issue.longitude}`)
      .join("/");
    return `https://www.google.com/maps/dir/${waypoints}`;
  }, [optimizedSequence]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      {/* Route Header & Filter Controls */}
      <Card tone="muted">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "var(--space-3)",
          }}
        >
          <div>
            <span style={{ fontWeight: 600, fontSize: "var(--font-size-md)" }}>
              📍 Field Worker Route Optimizer
            </span>
            <p style={{ margin: "var(--space-1) 0 0", fontSize: "var(--font-size-sm)", color: "var(--color-muted-foreground)" }}>
              Sequenced by GPS spatial proximity and SLA urgency to minimize travel time.
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
            <label htmlFor="worker-select" style={{ fontSize: "var(--font-size-sm)", color: "var(--color-muted-foreground)" }}>
              Worker:
            </label>
            <select
              id="worker-select"
              value={selectedWorkerId}
              onChange={(e) => setSelectedWorkerId(e.target.value)}
              style={{
                padding: "var(--space-2) var(--space-3)",
                borderRadius: "var(--radius-control)",
                background: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                color: "var(--color-foreground)",
                fontSize: "var(--font-size-sm)",
              }}
            >
              <option value="all">All Field Workers ({tasks.length} tasks)</option>
              {workers.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>

            {optimizedSequence.length > 0 ? (
              <a href={multiStopMapsUrl} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
                <Button variant="primary">
                  🧭 Open Full Route in Maps
                </Button>
              </a>
            ) : null}
          </div>
        </div>

        {optimizedSequence.length > 0 ? (
          <div
            style={{
              display: "flex",
              gap: "var(--space-4)",
              marginTop: "var(--space-3)",
              paddingTop: "var(--space-3)",
              borderTop: "1px solid var(--color-border)",
            }}
          >
            <div>
              <span style={{ fontSize: "var(--font-size-xs)", color: "var(--color-muted-foreground)" }}>Total Stops</span>
              <p style={{ margin: 0, fontWeight: 700, fontSize: "var(--font-size-lg)" }}>{optimizedSequence.length}</p>
            </div>
            <div>
              <span style={{ fontSize: "var(--font-size-xs)", color: "var(--color-muted-foreground)" }}>Est. Travel Distance</span>
              <p style={{ margin: 0, fontWeight: 700, fontSize: "var(--font-size-lg)" }}>
                {totalRouteKm.toFixed(1)} km <span style={{ fontSize: "var(--font-size-xs)", color: "var(--color-muted-foreground)" }}>({(totalRouteKm * 0.621371).toFixed(1)} mi)</span>
              </p>
            </div>
            <div>
              <span style={{ fontSize: "var(--font-size-xs)", color: "var(--color-muted-foreground)" }}>Est. Transit Time</span>
              <p style={{ margin: 0, fontWeight: 700, fontSize: "var(--font-size-lg)" }}>
                ~{Math.round(totalRouteKm * 2.5 + optimizedSequence.length * 15)} mins
              </p>
            </div>
          </div>
        ) : null}
      </Card>

      {/* Turn-by-Turn Optimized Stops */}
      {optimizedSequence.length === 0 ? (
        <Card>
          <p className={styles.emptyState}>No active assignments to optimize.</p>
        </Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          {optimizedSequence.map(({ task, legKm, stepNumber }) => {
            const mapsSingleUrl = `https://www.google.com/maps/dir/?api=1&destination=${task.issue.latitude},${task.issue.longitude}`;
            return (
              <Card key={task.assignmentId}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    gap: "var(--space-3)",
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "flex-start" }}>
                    <div
                      style={{
                        width: "32px",
                        height: "32px",
                        borderRadius: "50%",
                        background: task.issue.severity === "critical" ? "var(--color-civic-red)" : "var(--color-surface-muted)",
                        color: task.issue.severity === "critical" ? "#fff" : "var(--color-foreground)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: 700,
                        fontSize: "var(--font-size-sm)",
                        border: "1px solid var(--color-border)",
                        flexShrink: 0,
                      }}
                    >
                      {stepNumber}
                    </div>

                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", flexWrap: "wrap" }}>
                        <strong>{task.issue.trackingId}</strong>
                        <Badge tone="info">{CATEGORY_LABEL[task.issue.category]}</Badge>
                        <Badge tone={task.issue.severity === "critical" ? "danger" : "warning"}>
                          {SEVERITY_LABEL[task.issue.severity]}
                        </Badge>
                        {task.issue.isEmergency ? (
                          <Badge tone="danger">🚨 EMERGENCY (4h SLA)</Badge>
                        ) : null}
                      </div>

                      <p style={{ margin: "var(--space-1) 0", fontSize: "var(--font-size-sm)" }}>
                        {task.issue.description}
                      </p>

                      <div style={{ display: "flex", gap: "var(--space-3)", fontSize: "var(--font-size-xs)", color: "var(--color-muted-foreground)" }}>
                        <span>👤 {task.workerName}</span>
                        {task.issue.neighborhood ? <span>📍 {task.issue.neighborhood}</span> : null}
                        {legKm > 0 ? <span>🚗 +{legKm.toFixed(2)} km from Stop #{stepNumber - 1}</span> : <span>📍 Starting Point</span>}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
                    <a href={mapsSingleUrl} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
                      <Button variant="secondary">
                        🧭 Direct GPS
                      </Button>
                    </a>
                    <Link href={`/admin/queue/${task.issue._id}`} style={{ textDecoration: "none" }}>
                      <Button variant="secondary">
                        View Triage
                      </Button>
                    </Link>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
