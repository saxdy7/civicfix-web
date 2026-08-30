"use client";

import { useQuery } from "convex/react";
import { Badge, Card } from "@civicfix/ui-web";

import { CATEGORY_LABEL, SEVERITY_LABEL } from "@/lib/status";
import { api } from "@convex/_generated/api";
import type { Doc } from "@convex/_generated/dataModel";

import styles from "../../admin.module.css";

interface SOPStep {
  step: number;
  title: string;
  detail: string;
  icon: string;
}

interface WorkOrderGuide {
  department: string;
  slaHours: number;
  teamSize: string;
  requiredEquipment: string[];
  safetyPrecautions: string[];
  steps: SOPStep[];
}

const CATEGORY_GUIDES: Record<string, WorkOrderGuide> = {
  pothole: {
    department: "Streets, Highways & Transportation",
    slaHours: 24,
    teamSize: "2 Technicians + 1 Traffic Marshall",
    requiredEquipment: [
      "Asphalt compactor / Vibratory plate tamper",
      "Cold-pour / Hot-mix asphalt asphalt compound (min 50kg)",
      "Tack coat emulsion spray",
      "High-visibility traffic cones (minimum 6)",
      "Square-point asphalt shovel & steel rake",
    ],
    safetyPrecautions: [
      "Wear Class 3 High-Visibility Safety Vest and steel-toed boots.",
      "Place advance warning signage 50m upstream of traffic flow.",
      "Never turn back to incoming traffic without a dedicated spotter.",
    ],
    steps: [
      {
        step: 1,
        title: "Secure Site & Setup Traffic Perimeter",
        detail: "Deploy safety cones in a 30-degree taper around the work zone. Ensure safe vehicle bypass.",
        icon: "🚧",
      },
      {
        step: 2,
        title: "Excavate & Clean Cavity",
        detail: "Remove loose debris, broken asphalt, and standing water. Square the edges with an asphalt chisel.",
        icon: "🧹",
      },
      {
        step: 3,
        title: "Apply Tack Coat & Asphalt Mix",
        detail: "Coat edges with bonding emulsion. Fill with asphalt in 2-inch lifts, tamping each layer until flush with road grade.",
        icon: "🛢️",
      },
      {
        step: 4,
        title: "Compaction & Edge Sealing",
        detail: "Compact thoroughly to 95% density. Seal outer perimeter with asphalt sealant to prevent water infiltration.",
        icon: "🔨",
      },
      {
        step: 5,
        title: "Capture After Photo & Submit",
        detail: "Take a clear 'After' photo from the same viewpoint to satisfy community verification standards.",
        icon: "📸",
      },
    ],
  },
  garbage: {
    department: "Public Works & Environmental Sanitation",
    slaHours: 12,
    teamSize: "2 Sanitation Specialists",
    requiredEquipment: [
      "Heavy-duty waste collection vehicle with hydraulic lift",
      "Puncture-resistant heavy-duty industrial trash bags",
      "Walkway pressure washer / disinfectant spray unit",
      "Commercial push brooms & heavy debris scoops",
      "Biohazard containment kit (if hazardous materials present)",
    ],
    safetyPrecautions: [
      "Wear heavy-duty puncture-resistant nitrile-dipped gloves and safety goggles.",
      "Inspect for broken glass or sharp objects before lifting bags.",
      "Apply municipal biohazard protocols if biological waste is identified.",
    ],
    steps: [
      {
        step: 1,
        title: "Initial Hazard Assessment",
        detail: "Inspect the waste perimeter for hazardous, chemical, or sharp objects before handling.",
        icon: "🔍",
      },
      {
        step: 2,
        title: "Bulk Waste Collection",
        detail: "Load all overflowing and scattered debris into the sanitation vehicle hopper for compaction.",
        icon: "🚛",
      },
      {
        step: 3,
        title: "Container Inspection & Replacement",
        detail: "Inspect public receptacles for damaged lids or hinges; replace or sanitize bin lining.",
        icon: "🗑️",
      },
      {
        step: 4,
        title: "Sidewalk / Area Washdown",
        detail: "Sweep stray debris and pressure-wash any residue or liquid spills on the pavement.",
        icon: "💧",
      },
      {
        step: 5,
        title: "Document Resolution",
        detail: "Capture clean site 'After' photo showing cleared sidewalk and operational container.",
        icon: "📸",
      },
    ],
  },
  streetlight: {
    department: "Bureau of Street Lighting & Electrical Services",
    slaHours: 36,
    teamSize: "2 Certified Electricians / Line Technicians",
    requiredEquipment: [
      "Insulated aerial bucket truck or 28ft fiberglass extension ladder",
      "True-RMS digital multimeter & clamp meter",
      "Replacement LED luminaire module & photocell sensor",
      "High-voltage insulated hand tool set (1000V rated)",
      "Safety harness & fall-arrest lanyard",
    ],
    safetyPrecautions: [
      "Lockout / Tagout (LOTO) the pole base disconnect breaker before servicing fixtures.",
      "Wear dielectric safety gloves (Class 0, 1000V) and arc-flash face shield.",
      "Secure ladder or bucket truck outriggers firmly on level ground.",
    ],
    steps: [
      {
        step: 1,
        title: "Electrical Diagnostics & Circuit Test",
        detail: "Open pole base handhole and test voltage supply with multimeter to isolate ballast or feed failure.",
        icon: "⚡",
      },
      {
        step: 2,
        title: "Component Inspection / Replacement",
        detail: "Ascend to masthead. Test photocell sensor and replace damaged LED array or ballast.",
        icon: "💡",
      },
      {
        step: 3,
        title: "Wiring & Moisture Sealing",
        detail: "Ensure all wire-nut connections are waterproofed with heat-shrink silicone sleeving.",
        icon: "🔌",
      },
      {
        step: 4,
        title: "Circuit Energization & Functional Test",
        detail: "Re-energize breaker and cover photocell to verify immediate luminaire activation and lumen output.",
        icon: "✨",
      },
      {
        step: 5,
        title: "Verification & Documentation",
        detail: "Capture photo of the illuminated streetlight with pole asset ID clearly visible.",
        icon: "📸",
      },
    ],
  },
  other: {
    department: "City General Services & Code Compliance",
    slaHours: 48,
    teamSize: "1-2 Field Service Officers",
    requiredEquipment: [
      "Standard municipal field inspection toolkit",
      "Digital measuring tape & laser distance meter",
      "High-resolution evidence camera / tablet",
      "Temporary barrier tape & municipal notice placards",
    ],
    safetyPrecautions: [
      "Wear standard PPE (hard hat, high-vis vest, safety glasses).",
      "Assess structural stability before approaching damaged infrastructure.",
    ],
    steps: [
      {
        step: 1,
        title: "On-Site Diagnostic Survey",
        detail: "Measure scope of issue and determine municipal jurisdiction and department routing.",
        icon: "📋",
      },
      {
        step: 2,
        title: "Hazard Mitigation",
        detail: "Erect temporary caution tape or barrier if condition presents a public hazard.",
        icon: "⚠️",
      },
      {
        step: 3,
        title: "Execute Corrective Action",
        detail: "Perform necessary physical repairs or coordinate specialized municipal contractor dispatch.",
        icon: "🛠️",
      },
      {
        step: 4,
        title: "Quality Inspection",
        detail: "Inspect finished repair to confirm compliance with municipal code and durability standards.",
        icon: "✅",
      },
      {
        step: 5,
        title: "Closeout Documentation",
        detail: "Take completion photograph and log detailed staff resolution field notes.",
        icon: "📸",
      },
    ],
  },
};

function MediaItem({ media }: { media: Doc<"issueMedia"> }) {
  const url = useQuery(api.issueMedia.getUrl, { mediaId: media._id });
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        position: "relative",
        width: "220px",
        height: "160px",
        borderRadius: "8px",
        overflow: "hidden",
        border: "1px solid var(--color-border)",
        display: "block",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt="Citizen report evidence"
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />
      <span
        style={{
          position: "absolute",
          bottom: "4px",
          right: "4px",
          background: "rgba(0, 0, 0, 0.75)",
          color: "#fff",
          fontSize: "10px",
          padding: "2px 6px",
          borderRadius: "4px",
        }}
      >
        🔍 Click to expand
      </span>
    </a>
  );
}

export function IssueDetailsGuide({ issue }: { issue: Doc<"issues"> }) {
  const mediaList = useQuery(api.issueMedia.listForIssue, { issueId: issue._id }) ?? [];
  const guide = CATEGORY_GUIDES[issue.category] ?? CATEGORY_GUIDES.other;

  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${issue.latitude},${issue.longitude}`;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", marginBottom: "var(--space-4)" }}>
      {/* Action Plan & What To Do Banner */}
      <Card style={{ borderLeft: "4px solid var(--color-civic-blue, #0284c7)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "var(--space-2)", marginBottom: "var(--space-3)" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
              <span style={{ fontSize: "20px" }}>🛠️</span>
              <h2 className={styles.sectionTitle} style={{ margin: 0, fontSize: "var(--font-size-lg)" }}>
                Action Plan & Standard Operating Procedure (What To Do)
              </h2>
            </div>
            <p style={{ margin: "4px 0 0", color: "var(--color-muted-foreground)", fontSize: "var(--font-size-sm)" }}>
              Step-by-step resolution instructions for <strong>{CATEGORY_LABEL[issue.category]}</strong> triage and repair.
            </p>
          </div>

          <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
            <Badge tone="neutral">⏱️ Target SLA: {guide.slaHours}h</Badge>
            <Badge tone="neutral">👥 Team: {guide.teamSize}</Badge>
            <Badge tone="neutral">🏛️ {guide.department}</Badge>
          </div>
        </div>

        {/* Step-by-Step SOP Flow */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "var(--space-3)", marginTop: "var(--space-3)" }}>
          {guide.steps.map((st) => (
            <div
              key={st.step}
              style={{
                background: "var(--color-surface-muted, #1a1a1a)",
                border: "1px solid var(--color-border, #333)",
                borderRadius: "8px",
                padding: "var(--space-3)",
                display: "flex",
                flexDirection: "column",
                gap: "var(--space-1)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                <span style={{ fontSize: "18px" }}>{st.icon}</span>
                <strong style={{ fontSize: "var(--font-size-xs)", textTransform: "uppercase", color: "var(--color-civic-blue, #38bdf8)" }}>
                  Step {st.step}
                </strong>
              </div>
              <span style={{ fontWeight: 600, fontSize: "var(--font-size-sm)", color: "var(--color-foreground)" }}>
                {st.title}
              </span>
              <p style={{ margin: 0, fontSize: "var(--font-size-xs)", color: "var(--color-muted-foreground)", lineHeight: 1.4 }}>
                {st.detail}
              </p>
            </div>
          ))}
        </div>

        {/* Tools & Safety Section */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "var(--space-3)", marginTop: "var(--space-4)", paddingTop: "var(--space-3)", borderTop: "1px solid var(--color-border)" }}>
          <div>
            <strong style={{ display: "block", fontSize: "var(--font-size-xs)", textTransform: "uppercase", color: "var(--color-muted-foreground)", marginBottom: "var(--space-2)" }}>
              🧰 Required Equipment & Materials
            </strong>
            <ul style={{ margin: 0, paddingLeft: "var(--space-4)", fontSize: "var(--font-size-xs)", color: "var(--color-foreground)", lineHeight: 1.6 }}>
              {guide.requiredEquipment.map((eq, i) => (
                <li key={i}>{eq}</li>
              ))}
            </ul>
          </div>

          <div>
            <strong style={{ display: "block", fontSize: "var(--font-size-xs)", textTransform: "uppercase", color: "var(--color-civic-amber, #f59e0b)", marginBottom: "var(--space-2)" }}>
              ⚠️ Safety & PPE Requirements
            </strong>
            <ul style={{ margin: 0, paddingLeft: "var(--space-4)", fontSize: "var(--font-size-xs)", color: "var(--color-foreground)", lineHeight: 1.6 }}>
              {guide.safetyPrecautions.map((sp, i) => (
                <li key={i}>{sp}</li>
              ))}
            </ul>
          </div>
        </div>
      </Card>

      {/* Location, GPS Coordinates & Citizen Media */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "var(--space-4)" }}>
        {/* GPS Location Card */}
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-2)" }}>
            <h3 className={styles.sectionTitle} style={{ margin: 0 }}>
              📍 Exact Location & Navigation
            </h3>
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                padding: "4px 10px",
                background: "var(--color-civic-blue, #0284c7)",
                color: "#ffffff",
                borderRadius: "6px",
                fontSize: "var(--font-size-xs)",
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              Open in Google Maps ↗
            </a>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", fontSize: "var(--font-size-sm)" }}>
            <div>
              <span style={{ color: "var(--color-muted-foreground)", fontSize: "var(--font-size-xs)" }}>Neighborhood / Landmark: </span>
              <strong>{issue.neighborhood || "Downtown District"}</strong>
            </div>

            <div>
              <span style={{ color: "var(--color-muted-foreground)", fontSize: "var(--font-size-xs)" }}>GPS Coordinates: </span>
              <code style={{ background: "var(--color-surface-muted)", padding: "2px 6px", borderRadius: "4px" }}>
                {issue.latitude.toFixed(6)}, {issue.longitude.toFixed(6)}
              </code>
            </div>

            <div>
              <span style={{ color: "var(--color-muted-foreground)", fontSize: "var(--font-size-xs)" }}>Severity Rating: </span>
              <Badge tone={issue.severity === "critical" ? "danger" : issue.severity === "high" ? "warning" : "neutral"}>
                {SEVERITY_LABEL[issue.severity]} ({issue.severity.toUpperCase()})
              </Badge>
            </div>
          </div>
        </Card>

        {/* Citizen Submitted Media */}
        <Card>
          <h3 className={styles.sectionTitle} style={{ margin: "0 0 var(--space-2)" }}>
            📸 Citizen Submitted Photo Evidence
          </h3>

          {mediaList.length === 0 ? (
            <div style={{ padding: "var(--space-4)", background: "var(--color-surface-muted)", borderRadius: "8px", textAlign: "center", color: "var(--color-muted-foreground)", fontSize: "var(--font-size-xs)" }}>
              No photo attached with this initial report. Field worker should inspect site and take initial evidence photo.
            </div>
          ) : (
            <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
              {mediaList.map((m) => (
                <MediaItem key={m._id} media={m} />
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
