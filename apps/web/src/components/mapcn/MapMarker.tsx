"use client";

import { useEffect, useRef } from "react";
import { Marker, Popup } from "maplibre-gl";
import { useMap } from "./MapContainer";
import type { MapMarkerItem } from "./types";
import { CATEGORY_LABEL, STATUS_SHORT_LABEL } from "@/lib/status";
import styles from "./MapMarker.module.css";
import popupStyles from "./MapPopup.module.css";

const CATEGORY_GLYPHS: Record<string, string> = {
  pothole: "🕳️",
  garbage: "🗑️",
  streetlight: "💡",
  other: "⚠️",
};

const CATEGORY_CLASS_MAP: Record<string, string> = {
  pothole: styles.categoryPothole,
  garbage: styles.categoryGarbage,
  streetlight: styles.categoryStreetlight,
  other: styles.categoryOther,
};

const STATUS_CLASS_MAP: Record<string, string> = {
  reported: styles.statusReported,
  triaged: styles.statusTriaged,
  assigned: styles.statusAssigned,
  in_progress: styles.statusInProgress,
  pending_verification: styles.statusPendingVerification,
  resolved: styles.statusResolved,
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

interface MapMarkersProps {
  items: MapMarkerItem[];
  selectedId?: string;
  onSelect?: (id: string) => void;
  enableClustering?: boolean;
}

export function MapMarkers({
  items,
  selectedId,
  onSelect,
}: MapMarkersProps) {
  const { map } = useMap();
  const markersRef = useRef<Marker[]>([]);

  useEffect(() => {
    if (!map) return;

    // Clean up previous markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    items.forEach((item) => {
      const el = document.createElement("button");
      el.type = "button";
      const catClass = CATEGORY_CLASS_MAP[item.category] || styles.categoryOther;
      const isSel = item.id === selectedId;
      el.className = `${styles.marker} ${catClass} ${isSel ? styles.markerSelected : ""}`;
      el.innerHTML = `
        <span aria-hidden="true" style="font-size: 14px;">${CATEGORY_GLYPHS[item.category] || "•"}</span>
        <span class="${styles.statusDot} ${STATUS_CLASS_MAP[item.status] || ""}"></span>
      `;
      el.setAttribute(
        "aria-label",
        `${CATEGORY_LABEL[item.category]} issue at ${item.neighborhood || "Location"}`
      );

      el.addEventListener("click", () => {
        onSelect?.(item.id);
      });

      const popupContent = `
        <div class="${popupStyles.popup}">
          <div class="${popupStyles.popupHeader}">
            <h4 class="${popupStyles.popupTitle}">${escapeHtml(CATEGORY_LABEL[item.category])}</h4>
            <span style="font-size: 11px; font-weight: 600; color: var(--color-primary);">${escapeHtml(item.trackingId || "")}</span>
          </div>
          <p class="${popupStyles.popupMeta}">${escapeHtml(item.neighborhood || "Civic Zone")} · ${escapeHtml(STATUS_SHORT_LABEL[item.status] || item.status)}</p>
          ${item.description ? `<p class="${popupStyles.popupDescription}">${escapeHtml(item.description)}</p>` : ""}
          <a class="${popupStyles.popupLink}" href="/issues/${encodeURIComponent(item.id)}">View full report →</a>
        </div>
      `;

      const popup = new Popup({ offset: 16, closeButton: true }).setHTML(popupContent);

      const marker = new Marker({ element: el })
        .setLngLat([item.longitude, item.latitude])
        .setPopup(popup)
        .addTo(map);

      markersRef.current.push(marker);
    });

    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
    };
  }, [map, items, selectedId, onSelect]);

  return null;
}
