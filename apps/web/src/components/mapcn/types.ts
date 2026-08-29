import type { IssueCategory, IssueSeverity, IssueStatus } from "@/lib/types";

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface GeocoderResult {
  id: string;
  name: string;
  displayName: string;
  latitude: number;
  longitude: number;
  type?: string;
}

export interface MapMarkerItem {
  id: string;
  trackingId?: string;
  category: IssueCategory;
  status: IssueStatus;
  severity?: IssueSeverity;
  title?: string;
  description?: string;
  neighborhood?: string;
  latitude: number;
  longitude: number;
  photoUrl?: string;
}

export interface MapViewport {
  center: [number, number]; // [lng, lat]
  zoom: number;
  pitch?: number;
  bearing?: number;
}
