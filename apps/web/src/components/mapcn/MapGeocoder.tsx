"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useMap } from "./MapContainer";
import type { GeocoderResult } from "./types";
import styles from "./MapGeocoder.module.css";

interface MapGeocoderProps {
  placeholder?: string;
  onSelect?: (result: GeocoderResult) => void;
  className?: string;
}

export function MapGeocoder({
  placeholder = "Search location or address…",
  onSelect,
  className,
}: MapGeocoderProps) {
  const { flyTo } = useMap();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeocoderResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSearch = (value: string) => {
    setQuery(value);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!value.trim() || value.trim().length < 3) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    timerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        // Free OpenStreetMap Nominatim search
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
            value,
          )}&limit=5&addressdetails=1`,
          { headers: { "Accept-Language": "en" } },
        );
        if (!res.ok) throw new Error("Search failed");
        interface NominatimItem {
          place_id: number | string;
          display_name: string;
          lat: string;
          lon: string;
          type?: string;
        }
        const data = (await res.json()) as NominatimItem[];
        const mapped: GeocoderResult[] = data.map((item) => ({
          id: String(item.place_id),
          name: item.display_name.split(",")[0] || item.display_name,
          displayName: item.display_name,
          latitude: parseFloat(item.lat),
          longitude: parseFloat(item.lon),
          type: item.type,
        }));
        setResults(mapped);
        setIsOpen(true);
        setSelectedIndex(-1);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 350);
  };

  const handleSelectResult = (item: GeocoderResult) => {
    setQuery(item.name);
    setIsOpen(false);
    flyTo({ latitude: item.latitude, longitude: item.longitude }, 16);
    onSelect?.(item);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || results.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
    } else if (e.key === "Enter" && selectedIndex >= 0) {
      e.preventDefault();
      handleSelectResult(results[selectedIndex]);
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className={`${styles.container} ${className ?? ""}`}>
      <div className={styles.inputWrapper}>
        <span className={styles.searchIcon} aria-hidden="true">
          🔍
        </span>
        <input
          type="text"
          className={styles.input}
          placeholder={placeholder}
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          onFocus={() => results.length > 0 && setIsOpen(true)}
          onKeyDown={handleKeyDown}
        />
        {query ? (
          <button
            type="button"
            className={styles.clearButton}
            onClick={() => {
              setQuery("");
              setResults([]);
              setIsOpen(false);
            }}
            aria-label="Clear search"
          >
            ✕
          </button>
        ) : null}
      </div>

      {isOpen && (
        <ul className={styles.resultsList} role="listbox">
          {loading ? (
            <li className={styles.loadingText}>Searching locations…</li>
          ) : results.length === 0 ? (
            <li className={styles.loadingText}>No locations found</li>
          ) : (
            results.map((item, index) => (
              <li
                key={item.id}
                role="option"
                aria-selected={selectedIndex === index}
                className={`${styles.resultItem} ${
                  selectedIndex === index ? styles.resultItemActive : ""
                }`}
                onClick={() => handleSelectResult(item)}
              >
                <span className={styles.resultName}>{item.name}</span>
                <span className={styles.resultDesc}>{item.displayName}</span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
