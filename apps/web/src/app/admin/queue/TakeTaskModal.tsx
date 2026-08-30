"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Button } from "@civicfix/ui-web";

import { CATEGORY_LABEL, SEVERITY_LABEL } from "@/lib/status";
import { api } from "@convex/_generated/api";
import type { Doc, Id } from "@convex/_generated/dataModel";

interface TakeTaskModalProps {
  issue: Doc<"issues">;
  onClose: () => void;
  onSuccess?: () => void;
}

export function TakeTaskModal({ issue, onClose, onSuccess }: TakeTaskModalProps) {
  const departments = useQuery(api.departments.list, {});
  const workers = useQuery(api.users.listFieldWorkers, {});

  const routeToDepartment = useMutation(api.issues.routeToDepartment);
  const assignWorker = useMutation(api.assignments.assignWorker);

  const [departmentId, setDepartmentId] = useState<string>(
    issue.departmentId ?? (departments && departments.length > 0 ? departments[0]._id : ""),
  );
  const [workerId, setWorkerId] = useState<string>(
    workers && workers.length > 0 ? workers[0].id : "",
  );
  const [priorityNote, setPriorityNote] = useState<string>("Assigned for immediate field resolution.");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      if (departmentId) {
        try {
          await routeToDepartment({ issueId: issue._id, departmentId: departmentId as Id<"departments"> });
        } catch {
          // department already routed
        }
      }

      if (workerId) {
        await assignWorker({
          issueId: issue._id,
          workerId: workerId as Id<"users">,
        });
      }

      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to assign task.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.6)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: "var(--space-4)",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: "var(--color-surface, #ffffff)",
          border: "1px solid var(--color-border, #e2e8f0)",
          borderRadius: "var(--radius-lg, 12px)",
          maxWidth: "520px",
          width: "100%",
          padding: "var(--space-5)",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
          color: "var(--color-foreground, #0f172a)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-4)" }}>
          <h2 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 700, color: "var(--color-foreground, #0f172a)" }}>
            ⚡ Take & Assign Task: {issue.trackingId}
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "var(--color-muted-foreground, #64748b)",
              fontSize: "1.5rem",
              cursor: "pointer",
              padding: "2px 8px",
            }}
          >
            ✕
          </button>
        </div>

        <p style={{ margin: "0 0 var(--space-4)", fontSize: "var(--font-size-sm, 14px)", color: "var(--color-muted-foreground, #475569)", lineHeight: 1.5 }}>
          Assign <strong style={{ color: "var(--color-foreground, #0f172a)" }}>{CATEGORY_LABEL[issue.category]}</strong> ({SEVERITY_LABEL[issue.severity]} severity) to a municipal department and dispatch a field worker.
        </p>

        <form onSubmit={handleConfirm} style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <div>
            <label style={{ display: "block", fontSize: "var(--font-size-xs, 13px)", fontWeight: 700, marginBottom: "6px", color: "var(--color-foreground, #0f172a)" }}>
              🏛️ Responsible Department:
            </label>
            <select
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: "8px",
                background: "var(--color-surface, #ffffff)",
                border: "1px solid var(--color-border, #cbd5e1)",
                color: "var(--color-foreground, #0f172a)",
                fontSize: "var(--font-size-sm, 14px)",
                fontWeight: 500,
                outline: "none",
              }}
            >
              <option value="">Unassigned</option>
              {(departments ?? []).map((d) => (
                <option key={d._id} value={d._id} style={{ background: "var(--color-surface, #ffffff)", color: "#0f172a" }}>
                  {d.name} ({d.slaHours}h SLA)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "var(--font-size-xs, 13px)", fontWeight: 700, marginBottom: "6px", color: "var(--color-foreground, #0f172a)" }}>
              👷 Assign Field Worker:
            </label>
            <select
              value={workerId}
              onChange={(e) => setWorkerId(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: "8px",
                background: "var(--color-surface, #ffffff)",
                border: "1px solid var(--color-border, #cbd5e1)",
                color: "var(--color-foreground, #0f172a)",
                fontSize: "var(--font-size-sm, 14px)",
                fontWeight: 500,
                outline: "none",
              }}
            >
              <option value="">Choose worker…</option>
              {(workers ?? []).map((w) => (
                <option key={w.id} value={w.id} style={{ background: "var(--color-surface, #ffffff)", color: "#0f172a" }}>
                  {w.name} (Field Technician)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "var(--font-size-xs, 13px)", fontWeight: 700, marginBottom: "6px", color: "var(--color-foreground, #0f172a)" }}>
              📋 Dispatch Priority / Note:
            </label>
            <input
              type="text"
              value={priorityNote}
              onChange={(e) => setPriorityNote(e.target.value)}
              placeholder="e.g. Expedited patch required before evening traffic"
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: "8px",
                background: "var(--color-surface, #ffffff)",
                border: "1px solid var(--color-border, #cbd5e1)",
                color: "var(--color-foreground, #0f172a)",
                fontSize: "var(--font-size-sm, 14px)",
                boxSizing: "border-box",
                outline: "none",
              }}
            />
          </div>

          {error && (
            <div style={{ color: "#ef4444", fontSize: "var(--font-size-xs)", background: "rgba(239, 68, 68, 0.1)", padding: "8px 12px", borderRadius: "6px" }}>
              {error}
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--space-3)", marginTop: "var(--space-2)" }}>
            <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !workerId}>
              {saving ? "Assigning…" : "✓ Confirm & Dispatch Task"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
