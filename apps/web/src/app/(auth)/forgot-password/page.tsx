import type { Metadata } from "next";
import { Suspense } from "react";

import { getPlatformStats } from "@/lib/platform-stats";

import { AuthShowcase } from "../AuthShowcase";
import { ForgotPasswordForm } from "./ForgotPasswordForm";
import styles from "../auth.module.css";

export const metadata: Metadata = {
  title: "Reset password · CivicFix",
};

export default async function ForgotPasswordPage() {
  const stats = await getPlatformStats();

  return (
    <div className={styles.shell}>
      <Suspense fallback={null}>
        <ForgotPasswordForm />
      </Suspense>
      <AuthShowcase
        title="Back in, in under a minute."
        body="Reset your password with a one-time code sent to your email — no waiting on a magic link."
        points={["Email a 6-digit code", "Set a new password immediately", "Signed in the moment it's confirmed"]}
        stats={stats}
      />
    </div>
  );
}
