"use client";

import { useEffect } from "react";
import { useMap } from "./MapContainer";
import type { MapMarkerItem } from "./types";

interface MapHeatmapProps {
  items: MapMarkerItem[];
  enabled: boolean;
}

export function MapHeatmap({ items, enabled }: MapHeatmapProps) {
  const { map, isLoaded } = useMap();

  useEffect(() => {
    if (!map || !isLoaded) return;

    const sourceId = "civicfix-heatmap-source";
    const layerId = "civicfix-heatmap-layer";

    const geojson: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: items.map((item) => ({
        type: "Feature",
        properties: {
          id: item.id,
          weight: item.severity === "critical" ? 1.0 : item.severity === "high" ? 0.7 : 0.4,
        },
        geometry: {
          type: "Point",
          coordinates: [item.longitude, item.latitude],
        },
      })),
    };

    if (map.getSource(sourceId)) {
      (map.getSource(sourceId) as any).setData(geojson);
    } else {
      map.addSource(sourceId, {
        type: "geojson",
        data: geojson,
      });
    }

    if (enabled) {
      if (!map.getLayer(layerId)) {
        map.addLayer({
          id: layerId,
          type: "heatmap",
          source: sourceId,
          maxzoom: 17,
          paint: {
            // Increase heatmap weight based on issue severity
            "heatmap-weight": ["get", "weight"],
            // Increase intensity as a function of zoom level
            "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 0, 1, 15, 3],
            // Color ramp: blue -> cyan -> yellow -> orange -> red
            "heatmap-color": [
              "interpolate",
              ["linear"],
              ["heatmap-density"],
              0,
              "rgba(33,102,172,0)",
              0.2,
              "rgb(103,169,207)",
              0.4,
              "rgb(209,229,240)",
              0.6,
              "rgb(253,219,199)",
              0.8,
              "rgb(239,138,98)",
              1,
              "rgb(178,24,43)",
            ],
            "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 0, 4, 15, 25],
            "heatmap-opacity": 0.8,
          },
        });
      }
    } else {
      if (map.getLayer(layerId)) {
        map.removeLayer(layerId);
      }
    }

    return () => {
      if (map.getLayer(layerId)) {
        map.removeLayer(layerId);
      }
    };
  }, [map, isLoaded, items, enabled]);

  return null;
}
