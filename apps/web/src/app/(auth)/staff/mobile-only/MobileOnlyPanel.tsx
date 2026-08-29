"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@civicfix/ui-web";

import { supabase } from "@/lib/supabase";

import styles from "../../auth.module.css";

export function MobileOnlyPanel({ name }: { name: string }) {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    setSigningOut(true);
    await supabase?.auth.signOut();
    router.push("/");
    router.refresh();
  };

  return (
    <div className={styles.formSide}>
      <Link href="/" className={styles.brand}>
        CivicFix
      </Link>

      <div className={styles.formInner}>
        <div className={styles.formHead}>
          <h1 className={styles.title}>Your work happens in the app</h1>
          <p className={styles.subtitle}>
            Hi {name} — field-worker accounts accept assignments, submit before/after evidence, and
            message the department entirely through the CivicFix mobile app. There&apos;s nothing to
            do here on the web console.
          </p>
        </div>

        <p className={styles.footNote}>
          Open the CivicFix app on your phone and sign in with the same email to see your
          assignments.
        </p>

        <Button type="button" variant="secondary" onClick={handleSignOut} disabled={signingOut}>
          {signingOut ? "Signing out…" : "Sign out"}
        </Button>
      </div>
    </div>
  );
}
