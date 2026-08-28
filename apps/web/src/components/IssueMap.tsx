"use client";

import {
  GeolocateControl,
  Map as MapLibreMap,
  Marker,
  NavigationControl,
  Popup,
} from "maplibre-gl";
import { useCallback, useEffect, useRef, useState } from "react";

import { CATEGORY_LABEL, STATUS_SHORT_LABEL } from "@/lib/status";
import type { Issue } from "@/lib/types";

import styles from "./IssueMap.module.css";

import "maplibre-gl/dist/maplibre-gl.css";

// Free raster tiles — no API key required (MapLibre + OpenStreetMap).
// CARTO's dark basemap now requires a key, so we keep keyless OSM tiles and
// darken them with a CSS filter on the canvas (markers are DOM, so unaffected).
const TILE_STYLE = {
  version: 8 as const,
  sources: {
    osm: {
      type: "raster" as const,
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [{ id: "osm", type: "raster" as const, source: "osm" }],
};

const CATEGORY_INITIAL: Record<string, string> = {
  pothole: "P",
  garbage: "G",
  streetlight: "S",
  other: "•",
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

interface IssueMapProps {
  issues: Issue[];
  onSelect?: (issueId: string) => void;
  selectedId?: string;
}

export function IssueMap({ issues, onSelect, selectedId }: IssueMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const errorCountRef = useRef(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    let map: MapLibreMap;
    try {
      map = new MapLibreMap({
        container: containerRef.current,
        style: TILE_STYLE,
        center: [-122.4194, 37.7749],
        zoom: 12.5,
      });
    } catch {
      queueMicrotask(() => setFailed(true));
      return;
    }

    map.addControl(new NavigationControl({ showCompass: false }), "top-right");
    map.addControl(new GeolocateControl({ trackUserLocation: false }), "top-right");
    // A single failed/rate-limited OSM tile fires the same "error" event as a
    // fatal style failure — only fall back once errors pile up faster than
    // one bad tile, so shared/venue-network tile throttling doesn't drop the
    // whole map to the list fallback.
    map.on("error", () => {
      errorCountRef.current += 1;
      if (errorCountRef.current > 6) setFailed(true);
    });

    mapRef.current = map;

    return () => {
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, []);

  const handleMarkerClick = useCallback((issueId: string) => onSelect?.(issueId), [onSelect]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    issues.forEach((issue) => {
      const el = document.createElement("button");
      el.type = "button";
      el.className = `${styles.marker} ${issue.id === selectedId ? styles.markerSelected : ""}`;
      el.textContent = CATEGORY_INITIAL[issue.category] ?? "•";
      el.setAttribute("aria-label", `${CATEGORY_LABEL[issue.category]} at ${issue.neighborhood}`);
      el.addEventListener("click", () => handleMarkerClick(issue.id));

      const popup = new Popup({ offset: 18, closeButton: true }).setHTML(
        `<p class="${styles.popupTitle}">${escapeHtml(CATEGORY_LABEL[issue.category])} · ${escapeHtml(issue.trackingId)}</p>
         <p class="${styles.popupMeta}">${escapeHtml(issue.neighborhood)} — ${escapeHtml(STATUS_SHORT_LABEL[issue.status])}</p>
         <a class="${styles.popupLink}" href="/issues/${encodeURIComponent(issue.id)}">View report →</a>`,
      );

      const marker = new Marker({ element: el })
        .setLngLat([issue.longitude, issue.latitude])
        .setPopup(popup)
        .addTo(map);

      markersRef.current.push(marker);
    });
  }, [issues, handleMarkerClick, selectedId]);

  return (
    <div className={styles.wrapper}>
      <div ref={containerRef} className={styles.canvas} aria-hidden={failed} />
      {failed ? (
        <div className={styles.fallback}>
          <p className={styles.fallbackTitle}>Map unavailable</p>
          <p className={styles.fallbackBody}>
            The map could not load. Every issue is still listed below with its neighborhood and
            status.
          </p>
        </div>
      ) : null}
    </div>
  );
}
