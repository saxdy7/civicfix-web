"use client";

import { useMemo, useState } from "react";
import type { Issue } from "@/lib/types";
import {
  MapContainer,
  MapGeocoder,
  MapMarkers,
  MapHeatmap,
  type MapMarkerItem,
} from "./mapcn";
import styles from "./IssueMap.module.css";

interface IssueMapProps {
  issues: Issue[];
  onSelect?: (issueId: string) => void;
  selectedId?: string;
  showHeatmapToggle?: boolean;
}

export function IssueMap({
  issues,
  onSelect,
  selectedId,
  showHeatmapToggle = true,
}: IssueMapProps) {
  const [heatmapEnabled, setHeatmapEnabled] = useState(false);

  // Map issues to MapMarkerItem
  const markerItems: MapMarkerItem[] = useMemo(() => {
    return issues.map((issue) => ({
      id: issue.id,
      trackingId: issue.trackingId,
      category: issue.category,
      status: issue.status,
      severity: issue.severity,
      title: issue.trackingId,
      description: issue.description,
      neighborhood: issue.neighborhood,
      latitude: issue.latitude,
      longitude: issue.longitude,
    }));
  }, [issues]);

  const defaultCenter: [number, number] = useMemo(() => {
    if (issues.length > 0 && issues[0].longitude && issues[0].latitude) {
      return [issues[0].longitude, issues[0].latitude];
    }
    return [-122.4194, 37.7749];
  }, [issues]);

  return (
    <div className={styles.wrapper}>
      <MapContainer center={defaultCenter} zoom={12.5} showControls={true}>
        <MapGeocoder placeholder="Search city address or landmark…" />

        {showHeatmapToggle && (
          <div
            style={{
              position: "absolute",
              bottom: "16px",
              left: "16px",
              zIndex: 10,
              display: "flex",
              gap: "8px",
            }}
          >
            <button
              type="button"
              onClick={() => setHeatmapEnabled((prev) => !prev)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 12px",
                fontSize: "12px",
                fontWeight: 600,
                borderRadius: "var(--radius-control, 6px)",
                border: "1px solid var(--color-border, #334155)",
                background: heatmapEnabled
                  ? "var(--color-primary, #0284c7)"
                  : "var(--color-surface-raised, #1e293b)",
                color: "#ffffff",
                cursor: "pointer",
                boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
              }}
              aria-pressed={heatmapEnabled}
            >
              <span>🔥</span>
              <span>{heatmapEnabled ? "Heatmap Active" : "Show Risk Heatmap"}</span>
            </button>
          </div>
        )}

        <MapHeatmap items={markerItems} enabled={heatmapEnabled} />
        <MapMarkers items={markerItems} selectedId={selectedId} onSelect={onSelect} />
      </MapContainer>
    </div>
  );
}
