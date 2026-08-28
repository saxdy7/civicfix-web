"use client";

import { Map as MapLibreMap, NavigationControl } from "maplibre-gl";
import { useEffect, useRef, useState } from "react";

import styles from "./LocationPicker.module.css";

import "maplibre-gl/dist/maplibre-gl.css";

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

export interface PickedLocation {
  latitude: number;
  longitude: number;
}

interface LocationPickerProps {
  value: PickedLocation | null;
  onChange: (location: PickedLocation) => void;
}

const DEFAULT_CENTER: [number, number] = [-122.4194, 37.7749];

export function LocationPicker({ value, onChange }: LocationPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const onChangeRef = useRef(onChange);
  const errorCountRef = useRef(0);
  const [failed, setFailed] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  // Keep the latest callback without re-initialising the map.
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    let map: MapLibreMap;
    try {
      map = new MapLibreMap({
        container: containerRef.current,
        style: TILE_STYLE,
        center: value ? [value.longitude, value.latitude] : DEFAULT_CENTER,
        zoom: 14,
      });
    } catch {
      queueMicrotask(() => setFailed(true));
      return;
    }

    map.addControl(new NavigationControl({ showCompass: false }), "bottom-right");
    // A single failed/rate-limited OSM tile fires the same "error" event as a
    // fatal style failure — only fall back once errors pile up faster than
    // one bad tile, so shared/venue-network tile throttling doesn't kill the
    // whole picker.
    map.on("error", () => {
      errorCountRef.current += 1;
      if (errorCountRef.current > 6) setFailed(true);
    });

    // The pin is fixed at the centre; panning the map picks the location.
    const publish = () => {
      const c = map.getCenter();
      onChangeRef.current({ latitude: c.lat, longitude: c.lng });
    };
    map.on("moveend", publish);
    map.once("load", publish);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // Intentionally mount-only: re-running would tear down the user's pan.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const locateMe = () => {
    if (!navigator.geolocation || !mapRef.current) {
      setGeoError("Location isn't available in this browser.");
      return;
    }
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        mapRef.current?.flyTo({
          center: [pos.coords.longitude, pos.coords.latitude],
          zoom: 16,
        });
      },
      (err) => {
        setGeoError(
          err.code === err.PERMISSION_DENIED
            ? "Location permission denied — drag the map to set the pin instead."
            : "Couldn't get your location — drag the map to set the pin instead.",
        );
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  return (
    <div className={styles.wrapper}>
      <div ref={containerRef} className={styles.canvas} aria-hidden={failed} />

      {failed ? (
        <div className={styles.fallback}>
          <strong>Map unavailable</strong>
          <span>
            You can still submit — describe the location in the description field and staff will
            place the pin during triage.
          </span>
        </div>
      ) : (
        <>
          <span className={styles.crosshair} aria-hidden="true">
            📍
          </span>
          <button type="button" className={styles.locateButton} onClick={locateMe}>
            Use my location
          </button>
          {geoError ? <span className={styles.coords}>{geoError}</span> : null}
          {value ? (
            <span className={styles.coords}>
              {value.latitude.toFixed(5)}, {value.longitude.toFixed(5)}
            </span>
          ) : null}
        </>
      )}
    </div>
  );
}
