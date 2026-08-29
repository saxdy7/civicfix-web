import type { ReactNode } from "react";

import { AdminShell } from "@/components/AdminShell";
import { getSessionProfile } from "@/lib/session";

function roleLabel(roles: string[]): string {
  const primary = roles[0];
  if (!primary) return "Staff";
  return primary.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await getSessionProfile();
  const user = session
    ? { name: session.name, email: session.email, role: roleLabel(session.roles) }
    : { name: "Staff", email: "", role: "Staff" };

  return (
    <AdminShell user={user} isAdmin={session?.isAdmin ?? false}>
      {children}
    </AdminShell>
  );
}
