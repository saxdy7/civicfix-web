import { useEffect, useState, useMemo } from "react";
import { View, Text, Image, StyleSheet, Pressable, Platform, Linking, ActivityIndicator } from "react-native";
import * as Location from "expo-location";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";

import { color, fontFamily, fontSize, radius, spacing } from "../lib/theme";

interface MapLocationCardProps {
  latitude: number | null;
  longitude: number | null;
  accuracyMeters?: number | null;
  onUpdateLocation?: () => void;
  onLocationChange?: (coords: { latitude: number; longitude: number; accuracyMeters: number | null }) => void;
  locating?: boolean;
  onAddressResolved?: (address: string) => void;
}

// Convert longitude to OSM tile X
function lon2tile(lon: number, zoom: number) {
  return Math.floor(((lon + 180) / 360) * Math.pow(2, zoom));
}

// Convert latitude to OSM tile Y
function lat2tile(lat: number, zoom: number) {
  return Math.floor(
    ((1 -
      Math.log(
        Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180),
      ) /
        Math.PI) /
      2) *
      Math.pow(2, zoom),
  );
}

// Sub-pixel fractional offset within tile
function getTilePixelOffsets(lat: number, lon: number, zoom: number) {
  const n = Math.pow(2, zoom);
  const xExact = ((lon + 180) / 360) * n;
  const latRad = (lat * Math.PI) / 180;
  const yExact =
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;

  const tileX = Math.floor(xExact);
  const tileY = Math.floor(yExact);

  const subX = (xExact - tileX) * 256;
  const subY = (yExact - tileY) * 256;

  return { tileX, tileY, subX, subY };
}

export function MapLocationCard({
  latitude,
  longitude,
  accuracyMeters,
  onUpdateLocation,
  onLocationChange,
  locating = false,
  onAddressResolved,
}: MapLocationCardProps) {
  const [resolvedAddress, setResolvedAddress] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  const [zoom, setZoom] = useState(16);
  const [tileErrorCount, setTileErrorCount] = useState(0);

  // Reverse geocode when coordinates change
  useEffect(() => {
    if (latitude === null || longitude === null) {
      setResolvedAddress(null);
      return;
    }

    let active = true;
    setResolving(true);
    Location.reverseGeocodeAsync({ latitude, longitude })
      .then((results) => {
        if (!active) return;
        if (results && results.length > 0) {
          const item = results[0];
          const parts = [
            item.streetNumber,
            item.street || item.name,
            item.district || item.subregion,
            item.city,
            item.region,
          ].filter(Boolean);
          const formatted =
            parts.length > 0
              ? parts.join(", ")
              : `${item.city || "Civic Area"}, ${item.region || ""}`;
          setResolvedAddress(formatted);
          if (onAddressResolved) onAddressResolved(formatted);
        }
      })
      .catch(() => {
        if (active) setResolvedAddress("Near Pinned GPS Coordinates");
      })
      .finally(() => {
        if (active) setResolving(false);
      });

    return () => {
      active = false;
    };
  }, [latitude, longitude, onAddressResolved]);

  // Compute 3x2 tile grid around center coordinates
  const tileGrid = useMemo(() => {
    if (latitude === null || longitude === null) return [];
    const { tileX, tileY } = getTilePixelOffsets(latitude, longitude, zoom);

    const tiles = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const x = tileX + dx;
        const y = tileY + dy;
        // Clean Humanitarian OSM raster tiles (crisp streets, no API key watermark)
        const hotOsmUrl = `https://a.tile.openstreetmap.fr/hot/${zoom}/${x}/${y}.png`;
        const standardOsmUrl = `https://tile.openstreetmap.org/${zoom}/${x}/${y}.png`;
        tiles.push({
          key: `${zoom}-${x}-${y}`,
          dx,
          dy,
          url: tileErrorCount > 2 ? standardOsmUrl : hotOsmUrl,
        });
      }
    }
    return tiles;
  }, [latitude, longitude, zoom, tileErrorCount]);

  // Pixel offset of center pin
  const { subX, subY } = useMemo(() => {
    if (latitude === null || longitude === null) return { subX: 128, subY: 128 };
    return getTilePixelOffsets(latitude, longitude, zoom);
  }, [latitude, longitude, zoom]);

  // Move pin manually by delta
  const handleShiftPin = (dLat: number, dLon: number) => {
    if (latitude === null || longitude === null) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const newLat = latitude + dLat;
    const newLon = longitude + dLon;
    if (onLocationChange) {
      onLocationChange({ latitude: newLat, longitude: newLon, accuracyMeters: null });
    }
  };

  const openInExternalMaps = () => {
    if (latitude === null || longitude === null) return;
    const url =
      Platform.OS === "ios"
        ? `maps://?q=${latitude},${longitude}&ll=${latitude},${longitude}`
        : `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
    Linking.openURL(url).catch(() => {});
  };

  // Step delta for moving pin (~25 meters)
  const STEP = 0.00025;

  return (
    <View style={styles.card}>
      {latitude !== null && longitude !== null ? (
        <View style={styles.mapContainer}>
          {/* Tile Grid Container */}
          <View
            style={[
              styles.tileCanvas,
              {
                transform: [
                  { translateX: -(256 + subX) + 180 },
                  { translateY: -(256 + subY) + 90 },
                ],
              },
            ]}
          >
            {tileGrid.map((tile) => (
              <Image
                key={tile.key}
                source={{ uri: tile.url }}
                style={[
                  styles.tileImage,
                  {
                    left: (tile.dx + 1) * 256,
                    top: (tile.dy + 1) * 256,
                  },
                ]}
                onError={() => setTileErrorCount((c) => c + 1)}
              />
            ))}
          </View>

          {/* Glowing Target Marker in exact center of view */}
          <View style={styles.centerPinContainer} pointerEvents="none">
            <View style={styles.pulseRing} />
            <View style={styles.pinIconWrap}>
              <Ionicons name="location" size={32} color="#ef4444" />
            </View>
          </View>

          {/* D-Pad Pan & Swap Controls (Move Pin) */}
          <View style={styles.panControlsWrap}>
            <View style={styles.dpadRow}>
              <Pressable
                style={styles.dpadBtn}
                onPress={() => handleShiftPin(STEP, 0)}
                accessibilityLabel="Move Pin North"
              >
                <Ionicons name="chevron-up" size={16} color="#ffffff" />
              </Pressable>
            </View>
            <View style={styles.dpadRowMiddle}>
              <Pressable
                style={styles.dpadBtn}
                onPress={() => handleShiftPin(0, -STEP)}
                accessibilityLabel="Move Pin West"
              >
                <Ionicons name="chevron-back" size={16} color="#ffffff" />
              </Pressable>
              <View style={styles.dpadCenter}>
                <Ionicons name="pin" size={10} color="#ef4444" />
              </View>
              <Pressable
                style={styles.dpadBtn}
                onPress={() => handleShiftPin(0, STEP)}
                accessibilityLabel="Move Pin East"
              >
                <Ionicons name="chevron-forward" size={16} color="#ffffff" />
              </Pressable>
            </View>
            <View style={styles.dpadRow}>
              <Pressable
                style={styles.dpadBtn}
                onPress={() => handleShiftPin(-STEP, 0)}
                accessibilityLabel="Move Pin South"
              >
                <Ionicons name="chevron-down" size={16} color="#ffffff" />
              </Pressable>
            </View>
          </View>

          {/* Zoom Controls */}
          <View style={styles.zoomControls}>
            <Pressable
              style={styles.zoomBtn}
              onPress={() => setZoom((z) => Math.min(18, z + 1))}
            >
              <Ionicons name="add" size={16} color="#ffffff" />
            </Pressable>
            <Pressable
              style={styles.zoomBtn}
              onPress={() => setZoom((z) => Math.max(13, z - 1))}
            >
              <Ionicons name="remove" size={16} color="#ffffff" />
            </Pressable>
          </View>

          {/* Floating Maps App Button */}
          <Pressable style={styles.floatingMapsBtn} onPress={openInExternalMaps}>
            <Ionicons name="map-outline" size={13} color="#ffffff" />
            <Text style={styles.floatingMapsBtnText}>Open in Maps ↗</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.emptyMapContainer}>
          <Ionicons name="map-outline" size={32} color={color.mutedForeground} />
          <Text style={styles.emptyMapTitle}>No location captured yet</Text>
          <Text style={styles.emptyMapSub}>
            Tap below to use your live device GPS coordinates.
          </Text>
        </View>
      )}

      {/* Address & Coordinate Metadata */}
      <View style={styles.infoSection}>
        {latitude !== null && longitude !== null ? (
          <View style={styles.detailsCol}>
            <View style={styles.locationHeaderRow}>
              <View style={styles.greenLiveDot} />
              <Text style={styles.statusLiveText}>
                {accuracyMeters ? `GPS Live · ±${Math.round(accuracyMeters)}m accuracy` : "Custom Pin Pinned"}
              </Text>
              <Text style={styles.hintSwapText}>(Use arrows on map to adjust pin)</Text>
            </View>

            <Text style={styles.addressText} numberOfLines={2}>
              {resolving ? "Resolving street address…" : resolvedAddress || "Locating street name…"}
            </Text>

            <Text style={styles.coordText}>
              Latitude: {latitude.toFixed(6)} · Longitude: {longitude.toFixed(6)}
            </Text>
          </View>
        ) : null}

        {/* Use Current GPS Location Button */}
        {onUpdateLocation && (
          <Pressable
            style={[styles.locationBtn, locating && styles.locationBtnDisabled]}
            disabled={locating}
            onPress={onUpdateLocation}
          >
            {locating ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Ionicons
                name={latitude !== null ? "locate" : "navigate"}
                size={16}
                color="#ffffff"
              />
            )}
            <Text style={styles.locationBtnText}>
              {locating
                ? "Getting Live GPS…"
                : latitude !== null
                  ? "📍 Snap to Current GPS Location"
                  : "📍 Use My Current Location"}
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: color.surfaceMuted,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: color.border,
    overflow: "hidden",
  },
  mapContainer: {
    height: 180,
    width: "100%",
    position: "relative",
    backgroundColor: "#e2e8f0",
    overflow: "hidden",
  },
  tileCanvas: {
    position: "absolute",
    width: 768,
    height: 768,
    top: 0,
    left: 0,
  },
  tileImage: {
    position: "absolute",
    width: 256,
    height: 256,
    backgroundColor: "#f1f5f9",
  },
  centerPinContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  pulseRing: {
    position: "absolute",
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(239, 68, 68, 0.25)",
  },
  pinIconWrap: {
    alignItems: "center",
    justifyContent: "center",
    transform: [{ translateY: -12 }],
  },
  panControlsWrap: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: "rgba(15, 23, 42, 0.8)",
    borderRadius: 12,
    padding: 3,
    zIndex: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  dpadRow: {
    flexDirection: "row",
    justifyContent: "center",
  },
  dpadRowMiddle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  dpadCenter: {
    width: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  dpadBtn: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    margin: 1,
  },
  zoomControls: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(15, 23, 42, 0.8)",
    borderRadius: 8,
    zIndex: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
    overflow: "hidden",
  },
  zoomBtn: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  floatingMapsBtn: {
    position: "absolute",
    bottom: 8,
    right: 8,
    backgroundColor: "rgba(15, 23, 42, 0.85)",
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
    zIndex: 20,
  },
  floatingMapsBtnText: {
    color: "#ffffff",
    fontSize: 11,
    fontFamily: fontFamily.semibold,
  },
  emptyMapContainer: {
    height: 140,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing[3],
    backgroundColor: "rgba(15, 23, 42, 0.4)",
    gap: 6,
  },
  emptyMapTitle: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.semibold,
    color: color.foreground,
  },
  emptyMapSub: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.regular,
    color: color.mutedForeground,
    textAlign: "center",
  },
  infoSection: {
    padding: spacing[3],
    gap: spacing[2],
  },
  detailsCol: {
    gap: 3,
  },
  locationHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 2,
    flexWrap: "wrap",
  },
  greenLiveDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: color.civicGreen,
  },
  statusLiveText: {
    fontSize: fontSize.xs,
    fontFamily: fontFamily.semibold,
    color: color.civicGreen,
  },
  hintSwapText: {
    fontSize: 10,
    fontFamily: fontFamily.regular,
    color: color.mutedForeground,
  },
  addressText: {
    fontSize: fontSize.sm,
    fontFamily: fontFamily.bold,
    color: color.foreground,
    lineHeight: 18,
  },
  coordText: {
    fontSize: 11,
    fontFamily: fontFamily.regular,
    color: color.mutedForeground,
    marginTop: 2,
  },
  locationBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing[2],
    backgroundColor: color.civicBlue,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[3],
    borderRadius: radius.pill,
    marginTop: spacing[1],
  },
  locationBtnDisabled: {
    opacity: 0.6,
  },
  locationBtnText: {
    color: "#ffffff",
    fontSize: fontSize.sm,
    fontFamily: fontFamily.semibold,
  },
});
