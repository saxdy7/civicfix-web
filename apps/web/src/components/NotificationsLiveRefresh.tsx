"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { supabase } from "@/lib/supabase";

/** Refreshes the (server-rendered) notifications list the moment a new row lands, no polling. */
export function NotificationsLiveRefresh({ userId }: { userId: string }) {
  const router = useRouter();

  useEffect(() => {
    if (!supabase) return;
    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        () => router.refresh(),
      )
      .subscribe();

    return () => {
      supabase?.removeChannel(channel);
    };
  }, [userId, router]);

  return null;
}
