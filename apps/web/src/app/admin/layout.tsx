import type { ReactNode } from "react";

import { AdminShell } from "@/components/AdminShell";
import { createServerSupabase, getSessionProfile } from "@/lib/supabase-server";

function roleLabel(roles: string[]): string {
  const primary = roles[0];
  if (!primary) return "Staff";
  return primary.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

async function getPendingAccessRequestCount(): Promise<number> {
  const supabase = await createServerSupabase();
  if (!supabase) return 0;

  const { count } = await supabase
    .from("staff_access_requests")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");

  return count ?? 0;
}

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const [session, pendingAccessRequests] = await Promise.all([
    getSessionProfile(),
    getPendingAccessRequestCount(),
  ]);
  const user = session
    ? { name: session.name, email: session.email, role: roleLabel(session.roles) }
    : { name: "Staff", email: "", role: "Staff" };

  return (
    <AdminShell user={user} pendingAccessRequests={pendingAccessRequests}>
      {children}
    </AdminShell>
  );
}
