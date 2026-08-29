"use client";

import { useEffect, useRef, useState } from "react";
import { GeolocateControl, Map as MapLibreMap, NavigationControl } from "maplibre-gl";
import { DEFAULT_MAP_STYLE } from "./mapcn/MapContainer";
import styles from "./LocationPicker.module.css";
import "maplibre-gl/dist/maplibre-gl.css";

export interface PickedLocation {
  latitude: number;
  longitude: number;
  address?: string;
  neighborhood?: string;
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
  const [addressLabel, setAddressLabel] = useState<string | null>(value?.address ?? null);
  const [resolvingAddress, setResolvingAddress] = useState(false);
  const reverseTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Reverse geocode lat/lng to human-readable address
  const fetchAddress = (lat: number, lng: number) => {
    if (reverseTimerRef.current) clearTimeout(reverseTimerRef.current);
    reverseTimerRef.current = setTimeout(async () => {
      setResolvingAddress(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
          { headers: { "Accept-Language": "en" } },
        );
        if (!res.ok) throw new Error("Reverse geocode failed");
        const data = await res.json();
        const street =
          data.address?.road ||
          data.address?.pedestrian ||
          data.address?.suburb ||
          data.address?.neighbourhood ||
          "Pinned Location";
        const neighborhood =
          data.address?.neighbourhood ||
          data.address?.suburb ||
          data.address?.city_district ||
          data.address?.city ||
          "Civic Zone";

        const fullAddr = `${street}, ${neighborhood}`;
        setAddressLabel(fullAddr);
        onChangeRef.current({
          latitude: lat,
          longitude: lng,
          address: fullAddr,
          neighborhood,
        });
      } catch {
        // Fallback without address
        onChangeRef.current({ latitude: lat, longitude: lng });
      } finally {
        setResolvingAddress(false);
      }
    }, 450);
  };

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    let map: MapLibreMap;
    try {
      map = new MapLibreMap({
        container: containerRef.current,
        style: DEFAULT_MAP_STYLE,
        center: value ? [value.longitude, value.latitude] : DEFAULT_CENTER,
        zoom: 14,
      });
    } catch {
      queueMicrotask(() => setFailed(true));
      return;
    }

    map.addControl(new NavigationControl({ showCompass: false }), "bottom-right");
    map.addControl(new GeolocateControl({ trackUserLocation: false }), "top-right");

    map.on("error", () => {
      errorCountRef.current += 1;
      if (errorCountRef.current > 8) setFailed(true);
    });

    const publish = () => {
      const c = map.getCenter();
      fetchAddress(c.lat, c.lng);
    };

    map.on("moveend", publish);
    map.once("load", publish);

    mapRef.current = map;

    return () => {
      if (reverseTimerRef.current) clearTimeout(reverseTimerRef.current);
      map.remove();
      mapRef.current = null;
    };
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
            ? "Location permission denied — drag map to set the pin."
            : "Couldn't get GPS location — drag map to set pin.",
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
            📍 Use my GPS
          </button>
          {geoError ? <span className={styles.coords}>{geoError}</span> : null}
          {value ? (
            <span className={styles.coords}>
              {resolvingAddress ? (
                "Resolving address…"
              ) : addressLabel ? (
                `📍 ${addressLabel}`
              ) : (
                `${value.latitude.toFixed(5)}, ${value.longitude.toFixed(5)}`
              )}
            </span>
          ) : null}
        </>
      )}
    </div>
  );
}
