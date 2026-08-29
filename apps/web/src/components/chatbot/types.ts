import type { IssueCategory, IssueSeverity, IssueStatus } from "@/lib/types";

export type BotMessageType = "text" | "report_draft" | "status_card" | "duplicate_alert" | "action_card";

export interface BotAction {
  label: string;
  actionId: string;
  payload?: any;
  variant?: "primary" | "secondary" | "danger";
}

export interface BotMessage {
  id: string;
  sender: "bot" | "user" | "system";
  text: string;
  createdAt: string;
  type?: BotMessageType;
  data?: {
    draft?: {
      category: IssueCategory;
      severity: IssueSeverity;
      description: string;
      neighborhood: string;
      landmark?: string;
      latitude?: number;
      longitude?: number;
      photoUrl?: string;
    };
    statusResult?: {
      trackingId: string;
      category: IssueCategory;
      status: IssueStatus;
      severity: IssueSeverity;
      neighborhood: string;
      createdAt: string;
      updatedAt: string;
      department?: string;
      timeline: { status: IssueStatus; note?: string; time: string }[];
    };
    duplicates?: {
      id: string;
      trackingId: string;
      category: IssueCategory;
      distanceMeters: number;
      neighborhood: string;
    }[];
  };
  actions?: BotAction[];
}

export interface BotReportPayload {
  category: IssueCategory;
  severity: IssueSeverity;
  description: string;
  neighborhood: string;
  latitude: number;
  longitude: number;
  photoUrl?: string;
}
