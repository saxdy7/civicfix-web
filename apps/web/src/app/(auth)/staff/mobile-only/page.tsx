import type { Metadata } from "next";

import { getPlatformStats } from "@/lib/platform-stats";
import { getSessionProfile } from "@/lib/supabase-server";

import { AuthShowcase } from "../../AuthShowcase";
import { MobileOnlyPanel } from "./MobileOnlyPanel";
import styles from "../../auth.module.css";

export const metadata: Metadata = {
  title: "Use the mobile app · CivicFix",
};

export default async function StaffMobileOnlyPage() {
  const [stats, session] = await Promise.all([getPlatformStats(), getSessionProfile()]);

  return (
    <div className={styles.shell}>
      <MobileOnlyPanel name={session?.name ?? "there"} />
      <AuthShowcase
        title="Field work, built for the field."
        body="Assignments, before/after photo evidence, and department chat are all designed for a phone in your hand on-site — not a desk browser."
        points={[
          "Accept or reassign a job in one tap",
          "Capture before/after evidence with the camera",
          "Message the department straight from the job",
        ]}
        stats={stats}
      />
    </div>
  );
}
