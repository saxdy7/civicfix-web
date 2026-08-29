"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import type { BotAction, BotMessage } from "./types";
import { generateBotResponse } from "./bot-engine";

const INITIAL_GREETING: BotMessage = {
  id: "initial-msg",
  sender: "bot",
  text: "👋 Hi! I am **CivicBot**, your automated civic assistant. Describe an issue you want to report, upload a photo, or enter a Tracking ID to check status.",
  createdAt: new Date().toISOString(),
  actions: [
    { label: "🕳️ Report Pothole", actionId: "prompt_pothole" },
    { label: "🗑️ Report Garbage", actionId: "prompt_garbage" },
    { label: "💡 Report Streetlight", actionId: "prompt_streetlight" },
    { label: "🔍 Track Issue #CF-10234", actionId: "track_sample", payload: { id: "CF-10234" } },
  ],
};

export function useCivicBot() {
  const router = useRouter();
  const [messages, setMessages] = useState<BotMessage[]>([INITIAL_GREETING]);
  const [input, setInput] = useState("");
  const [attachedPhoto, setAttachedPhoto] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [lastSubmittedId, setLastSubmittedId] = useState<string | null>(null);

  const sendMessage = useCallback(
    async (text: string, photoUrl?: string) => {
      const userText = text.trim();
      if (!userText && !photoUrl) return;

      const userMsg: BotMessage = {
        id: `user-${Date.now()}`,
        sender: "user",
        text: userText || "Uploaded an image for triage",
        createdAt: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setAttachedPhoto(null);
      setIsTyping(true);

      // Simulate realistic AI reasoning delay
      setTimeout(() => {
        const botReply = generateBotResponse(userText, photoUrl || attachedPhoto || undefined);
        setMessages((prev) => [...prev, botReply]);
        setIsTyping(false);
      }, 700);
    },
    [attachedPhoto]
  );

  const handleAction = useCallback(
    async (action: BotAction) => {
      if (action.actionId === "prompt_pothole") {
        sendMessage("There is a large pothole on 4th Street causing traffic disruption.");
      } else if (action.actionId === "prompt_garbage") {
        sendMessage("Overflowing garbage containers near Central Square.");
      } else if (action.actionId === "prompt_streetlight") {
        sendMessage("Streetlight broken and dark on Elm Street.");
      } else if (action.actionId === "prompt_track" || action.actionId === "track_sample") {
        const id = action.payload?.id || "CF-10234";
        sendMessage(`Check status of ${id}`);
      } else if (action.actionId === "submit_report") {
        // Find last report draft
        const lastDraftMsg = [...messages].reverse().find((m) => m.type === "report_draft" && m.data?.draft);
        if (!lastDraftMsg || !lastDraftMsg.data?.draft) return;

        const draft = lastDraftMsg.data.draft;
        const newTrackingId = `CF-${Math.floor(10000 + Math.random() * 90000)}`;

        setIsTyping(true);

        // Illustrative only — this widget doesn't collect a real GPS pin or
        // attribute a reporter, so it never writes to Convex. A real report
        // always goes through /app/report's ReportComposer, which does.

        setTimeout(() => {
          setIsTyping(false);
          setLastSubmittedId(newTrackingId);
          setMessages((prev) => [
            ...prev,
            {
              id: `bot-confirm-${Date.now()}`,
              sender: "bot",
              text: `🎉 **Issue Successfully Submitted & Routed!**\n\nYour official tracking ID is **${newTrackingId}**.\n\n• **Category:** ${draft.category.toUpperCase()}\n• **Priority:** ${draft.severity.toUpperCase()}\n• **Location:** ${draft.neighborhood}\n• **Status:** Triaged & Sent to Responsible Municipal Department\n\nYou will receive automated updates at each stage of resolution.`,
              createdAt: new Date().toISOString(),
              type: "action_card",
              actions: [
                { label: `🔍 Track ${newTrackingId}`, actionId: "track_sample", payload: { id: newTrackingId } },
                { label: "🗺️ View Live City Map", actionId: "open_map" },
                { label: "➕ Report Another Issue", actionId: "prompt_pothole" },
              ],
            },
          ]);
        }, 800);
      } else if (action.actionId === "open_map") {
        router.push("/map");
      } else if (action.actionId === "view_issue" && action.payload?.id) {
        router.push(`/issues/${action.payload.id}`);
      }
    },
    [messages, sendMessage, router]
  );

  return {
    messages,
    input,
    setInput,
    attachedPhoto,
    setAttachedPhoto,
    isTyping,
    sendMessage,
    handleAction,
    lastSubmittedId,
  };
}
