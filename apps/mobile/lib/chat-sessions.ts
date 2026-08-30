/**
 * CivicFix AI Chat History & Sessions Persistence
 * Manages multi-conversation threads, titles, messages, and switching.
 */

import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

export interface ChatMessage {
  id: string;
  sender: "bot" | "user";
  text: string;
  createdAt: number;
  extracted?: {
    category?: "pothole" | "garbage" | "streetlight" | "other";
    severity?: "low" | "medium" | "high" | "critical";
    description?: string;
    locationText?: string;
    latitude?: number;
    longitude?: number;
    photoUri?: string;
    photoBase64?: string;
  };
  actions?: {
    label: string;
    actionId: "confirm_report" | "modify_report" | "go_to_report" | "go_to_my_reports" | "go_to_community" | "quick_prompt" | "view_report_detail";
    variant?: "primary" | "secondary";
    promptPayload?: string;
  }[];
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

const CHAT_SESSIONS_STORAGE_KEY = "civicfix.chat_sessions.v1";

// Memory cache fallback for web or rapid sync
let memorySessions: ChatSession[] = [];

export async function loadAllChatSessions(): Promise<ChatSession[]> {
  try {
    if (Platform.OS === "web") {
      return memorySessions;
    }
    const raw = await SecureStore.getItemAsync(CHAT_SESSIONS_STORAGE_KEY);
    if (!raw) return memorySessions;
    const parsed: ChatSession[] = JSON.parse(raw);
    memorySessions = parsed;
    return parsed.sort((a, b) => b.updatedAt - a.updatedAt);
  } catch (err) {
    console.warn("Error reading chat sessions:", err);
    return memorySessions;
  }
}

export async function saveChatSession(session: ChatSession): Promise<void> {
  try {
    const existing = await loadAllChatSessions();
    const filtered = existing.filter((s) => s.id !== session.id);
    const updated = [session, ...filtered];
    memorySessions = updated;

    if (Platform.OS !== "web") {
      await SecureStore.setItemAsync(CHAT_SESSIONS_STORAGE_KEY, JSON.stringify(updated.slice(0, 30)));
    }
  } catch (err) {
    console.warn("Error saving chat session:", err);
  }
}

export async function deleteChatSession(sessionId: string): Promise<ChatSession[]> {
  try {
    const existing = await loadAllChatSessions();
    const updated = existing.filter((s) => s.id !== sessionId);
    memorySessions = updated;

    if (Platform.OS !== "web") {
      await SecureStore.setItemAsync(CHAT_SESSIONS_STORAGE_KEY, JSON.stringify(updated));
    }
    return updated;
  } catch (err) {
    console.warn("Error deleting chat session:", err);
    return memorySessions;
  }
}

export function generateChatTitle(firstMessageText: string): string {
  const clean = firstMessageText.trim().replace(/^[^a-zA-Z0-9]+/, "");
  if (!clean) return "New Conversation";
  if (clean.length <= 32) return clean;
  return clean.slice(0, 30) + "…";
}
