import type { ReactNode } from "react";

import { ResidentShell } from "@/components/ResidentShell";
import { getSessionProfile } from "@/lib/session";

export default async function ResidentLayout({ children }: { children: ReactNode }) {
  const session = await getSessionProfile();
  const user = session ? { name: session.name, email: session.email } : { name: "Resident", email: "" };

  return <ResidentShell user={user}>{children}</ResidentShell>;
}
