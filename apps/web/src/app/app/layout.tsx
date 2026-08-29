import type { ReactNode } from "react";

import { NotificationsLiveRefresh } from "@/components/NotificationsLiveRefresh";
import { ResidentShell } from "@/components/ResidentShell";
import { createServerSupabase, getSessionProfile } from "@/lib/supabase-server";

export default async function ResidentLayout({ children }: { children: ReactNode }) {
  const session = await getSessionProfile();
  const user = session
    ? { name: session.name, email: session.email }
    : { name: "Resident", email: "" };

  let counts: { reports: number; notifications: number } | undefined;

  if (session) {
    const supabase = await createServerSupabase();
    if (supabase) {
      const [{ count: reportsCount }, { count: notificationsCount }] = await Promise.all([
        supabase
          .from("issues")
          .select("id", { count: "exact", head: true })
          .eq("reporter_id", session.userId),
        supabase
          .from("notifications")
          .select("id", { count: "exact", head: true })
          .eq("user_id", session.userId)
          .is("read_at", null),
      ]);

      counts = { reports: reportsCount ?? 0, notifications: notificationsCount ?? 0 };
    }
  }

  return (
    <ResidentShell user={user} counts={counts}>
      {session ? <NotificationsLiveRefresh userId={session.userId} /> : null}
      {children}
    </ResidentShell>
  );
}
