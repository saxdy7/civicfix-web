import type {
  Issue,
  IssueCategory,
  IssueEvent,
  IssueSeverity,
  IssueStatus,
} from "./types";

interface RawGeoJsonPoint {
  type?: string;
  coordinates?: [number, number];
}

function hexToDouble(hex: string, littleEndian: boolean): number {
  const bytes = new Uint8Array(8);
  for (let i = 0; i < 8; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return new DataView(bytes.buffer).getFloat64(0, littleEndian);
}

/**
 * PostgREST serializes a PostGIS `geography(Point)` column as GeoJSON
 * ({ type: "Point", coordinates: [lng, lat] }) by default. Some
 * configurations instead return raw (E)WKB hex, so this also parses that
 * shape defensively rather than letting the map silently break.
 */
function parseLocation(raw: unknown): { latitude: number; longitude: number } {
  if (raw && typeof raw === "object" && Array.isArray((raw as RawGeoJsonPoint).coordinates)) {
    const [lng, lat] = (raw as RawGeoJsonPoint).coordinates as [number, number];
    return { latitude: lat, longitude: lng };
  }

  if (typeof raw === "string") {
    const trimmed = raw.trim();

    if (trimmed.startsWith("{")) {
      try {
        const parsed = JSON.parse(trimmed) as RawGeoJsonPoint;
        if (Array.isArray(parsed.coordinates)) {
          const [lng, lat] = parsed.coordinates;
          return { latitude: lat, longitude: lng };
        }
      } catch {
        // Not valid JSON — fall through to WKB parsing below.
      }
    } else if (/^[0-9a-fA-F]+$/.test(trimmed) && trimmed.length >= 34) {
      try {
        const littleEndian = trimmed.substring(0, 2) === "01";
        // EWKB Point with SRID flag: byte order (1) + type+flags (4) + SRID (4) + X (8) + Y (8).
        const hasSrid = trimmed.length >= 42;
        const offset = hasSrid ? 18 : 10;
        const x = hexToDouble(trimmed.substring(offset, offset + 16), littleEndian);
        const y = hexToDouble(trimmed.substring(offset + 16, offset + 32), littleEndian);
        if (Number.isFinite(x) && Number.isFinite(y)) return { latitude: y, longitude: x };
      } catch {
        // Fall through to the default below.
      }
    }
  }

  return { latitude: 0, longitude: 0 };
}

/** Never expose a raw reporter id to the client — mask it like the mock data did. */
export function maskReporter(reporterId: string | null | undefined): string {
  if (!reporterId) return "Resident";
  return `Resident ****${reporterId.slice(-2)}`;
}

export interface RawIssueRow {
  id: string;
  tracking_id: string;
  category: IssueCategory;
  status: IssueStatus;
  severity: IssueSeverity;
  priority: IssueSeverity;
  description: string;
  neighborhood: string | null;
  location: unknown;
  reporter_id: string | null;
  duplicate_of_issue_id: string | null;
  created_at: string;
  updated_at: string;
  departments?: { name: string } | { name: string }[] | null;
}

export interface RawIssueEventRow {
  id: string;
  status: IssueStatus;
  note: string | null;
  created_at: string;
}

export function mapIssueEvent(row: RawIssueEventRow): IssueEvent {
  return {
    id: row.id,
    status: row.status,
    note: row.note ?? undefined,
    createdAt: row.created_at,
  };
}

export function mapIssueRow(row: RawIssueRow, events: RawIssueEventRow[] = []): Issue {
  const { latitude, longitude } = parseLocation(row.location);
  const departmentRel = Array.isArray(row.departments) ? row.departments[0] : row.departments;

  return {
    id: row.id,
    trackingId: row.tracking_id,
    category: row.category,
    status: row.status,
    severity: row.severity,
    priority: row.priority,
    description: row.description,
    neighborhood: row.neighborhood ?? "Unspecified",
    department: departmentRel?.name ?? "Unassigned",
    reporterMasked: maskReporter(row.reporter_id),
    latitude,
    longitude,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    events: events
      .map(mapIssueEvent)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    duplicateCandidateId: row.duplicate_of_issue_id ?? undefined,
  };
}
