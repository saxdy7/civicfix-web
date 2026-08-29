"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  GeolocateControl,
  Map as MapLibreMap,
  NavigationControl,
} from "maplibre-gl";

import type { Coordinates, MapViewport } from "./types";
import styles from "./MapContainer.module.css";
import "maplibre-gl/dist/maplibre-gl.css";

// Keyless OSM Tiles configuration (fallback when no Mapbox token is set)
export const OSM_TILE_STYLE = {
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

const mapboxToken =
  process.env.NEXT_PUBLIC_MAPBOX_TOKEN || process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

export const DEFAULT_MAP_STYLE = mapboxToken
  ? `https://api.mapbox.com/styles/v1/mapbox/dark-v11?access_token=${mapboxToken}`
  : OSM_TILE_STYLE;

interface MapContextValue {
  map: MapLibreMap | null;
  isLoaded: boolean;
  flyTo: (coords: Coordinates, zoom?: number) => void;
  resetNorth: () => void;
}

const MapContext = createContext<MapContextValue>({
  map: null,
  isLoaded: false,
  flyTo: () => {},
  resetNorth: () => {},
});

export const useMap = () => useContext(MapContext);

export interface MapContainerProps {
  center?: [number, number]; // [lng, lat]
  zoom?: number;
  pitch?: number;
  bearing?: number;
  className?: string;
  children?: ReactNode;
  showControls?: boolean;
  onMoveEnd?: (viewport: MapViewport) => void;
  onClick?: (coords: Coordinates) => void;
  style?: React.CSSProperties;
}

export function MapContainer({
  center = [-122.4194, 37.7749],
  zoom = 12.5,
  pitch = 0,
  bearing = 0,
  className,
  children,
  showControls = true,
  onMoveEnd,
  onClick,
  style,
}: MapContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mapInstance, setMapInstance] = useState<MapLibreMap | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const errorCountRef = useRef(0);

  const flyTo = useCallback((coords: Coordinates, targetZoom?: number) => {
    if (!mapInstance) return;
    mapInstance.flyTo({
      center: [coords.longitude, coords.latitude],
      zoom: targetZoom ?? 15,
      essential: true,
    });
  }, [mapInstance]);

  const resetNorth = useCallback(() => {
    if (!mapInstance) return;
    mapInstance.resetNorthPitch({ duration: 600 });
  }, [mapInstance]);

  useEffect(() => {
    if (!containerRef.current) return;

    let map: MapLibreMap;
    try {
      map = new MapLibreMap({
        container: containerRef.current,
        style: DEFAULT_MAP_STYLE,
        center,
        zoom,
        pitch,
        bearing,
      });
    } catch {
      queueMicrotask(() => setFailed(true));
      return;
    }

    if (showControls) {
      map.addControl(new NavigationControl({ showCompass: true }), "top-right");
      map.addControl(new GeolocateControl({ trackUserLocation: false }), "top-right");
    }

    map.on("load", () => {
      setIsLoaded(true);
    });

    map.on("error", () => {
      errorCountRef.current += 1;
      if (errorCountRef.current > 8) setFailed(true);
    });

    if (onMoveEnd) {
      map.on("moveend", () => {
        const c = map.getCenter();
        onMoveEnd({
          center: [c.lng, c.lat],
          zoom: map.getZoom(),
          pitch: map.getPitch(),
          bearing: map.getBearing(),
        });
      });
    }

    if (onClick) {
      map.on("click", (e) => {
        onClick({ latitude: e.lngLat.lat, longitude: e.lngLat.lng });
      });
    }

    setMapInstance(map);

    return () => {
      map.remove();
      setMapInstance(null);
      setIsLoaded(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <MapContext.Provider value={{ map: mapInstance, isLoaded, flyTo, resetNorth }}>
      <div className={`${styles.wrapper} ${className ?? ""}`} style={style}>
        <div ref={containerRef} className={styles.canvas} aria-hidden={failed} />
        {failed ? (
          <div className={styles.fallback}>
            <p className={styles.fallbackTitle}>Map preview offline</p>
            <p>
              Free map tiles are temporarily inaccessible. All data is preserved and accessible in
              the list below.
            </p>
          </div>
        ) : null}
        {isLoaded && children}
      </div>
    </MapContext.Provider>
  );
}
