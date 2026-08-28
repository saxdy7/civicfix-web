import type { Metadata } from "next";
import { Suspense } from "react";

import { getPlatformStats } from "@/lib/platform-stats";

import { AuthShowcase } from "../AuthShowcase";
import { SignUpForm } from "./SignUpForm";
import styles from "../auth.module.css";

export const metadata: Metadata = {
  title: "Create your account · CivicFix",
};

export default async function SignUpPage() {
  const stats = await getPlatformStats();

  return (
    <div className={styles.shell}>
      <Suspense fallback={null}>
        <SignUpForm />
      </Suspense>
      <AuthShowcase
        title="Turn a photo into a public result."
        body="Create an account to report civic issues, get a tracking ID, and follow every stage from triage to verified resolution."
        points={[
          "Report in under a minute — photo and pin",
          "A tracking ID and status trail for every report",
          "Notified the moment anything changes",
        ]}
        stats={stats}
      />
    </div>
  );
}
