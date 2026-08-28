import type { Metadata } from "next";
import { Suspense } from "react";

import { getPlatformStats } from "@/lib/platform-stats";

import { AuthShowcase } from "../AuthShowcase";
import { SignInForm } from "./SignInForm";
import styles from "../auth.module.css";

export const metadata: Metadata = {
  title: "Sign in · CivicFix",
};

export default async function SignInPage() {
  const stats = await getPlatformStats();

  return (
    <div className={styles.shell}>
      <Suspense fallback={null}>
        <SignInForm />
      </Suspense>
      <AuthShowcase
        title="Every report, accounted for."
        body="Sign in to follow your reports through triage, assignment, and verified resolution — or to pick up your department's queue."
        points={[
          "Live status on every report you file",
          "Push notifications at each stage",
          "Field assignments and evidence capture",
        ]}
        stats={stats}
      />
    </div>
  );
}
