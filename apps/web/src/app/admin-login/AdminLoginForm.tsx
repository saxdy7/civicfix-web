"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@civicfix/ui-web";

import { isSupabaseConfigured, supabase } from "@/lib/supabase";

import styles from "./admin-login.module.css";

function safeNextPath(value: string | null): string | null {
  if (!value || !value.startsWith("/admin")) return null;
  return value;
}

export function AdminLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNextPath(searchParams.get("next"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!email.includes("@")) return setError("Enter a valid email address.");
    if (password.length < 8) return setError("Enter your password.");

    setError(null);
    setSubmitting(true);

    if (!supabase) {
      setError("Admin sign-in isn't available in preview mode — Supabase isn't configured.");
      setSubmitting(false);
      return;
    }

    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError) {
      setError("Incorrect email or password.");
      setSubmitting(false);
      return;
    }

    const userId = data.user?.id;
    const { data: roles } = userId
      ? await supabase.from("user_roles").select("role").eq("user_id", userId).eq("role", "administrator")
      : { data: null };

    if (!roles || roles.length === 0) {
      // A real Auth account, but not an administrator — never let it into
      // the admin portal even briefly. This UID/password pair authenticated
      // successfully; only the role check below decides admin access.
      await supabase.auth.signOut();
      setError("This account does not have administrator access.");
      setSubmitting(false);
      return;
    }

    router.push(next ?? "/admin");
    router.refresh();
  };

  return (
    <form className={styles.card} onSubmit={handleSubmit} noValidate>
      <Link href="/" className={styles.brand}>
        CivicFix
      </Link>
      <span className={styles.badge}>Administrator</span>

      <div>
        <h1 className={styles.title}>Admin sign in</h1>
        <p className={styles.subtitle}>
          For provisioned municipal administrators only. Residents and staff applicants should use{" "}
          <Link href="/sign-in">the regular sign-in page</Link>.
        </p>
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="email">
          Email
        </label>
        <input
          id="email"
          type="email"
          className={styles.input}
          placeholder="admin@civicfix.demo"
          autoCapitalize="none"
          autoCorrect="off"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="password">
          Password
        </label>
        <input
          id="password"
          type="password"
          className={styles.input}
          placeholder="Enter your password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />
      </div>

      {error ? (
        <p className={styles.errorText} role="alert">
          {error}
        </p>
      ) : null}

      <Button type="submit" block disabled={submitting}>
        {submitting ? "Signing in…" : "Sign in"}
      </Button>

      <p className={styles.footNote}>
        <Link href="/">← Back to CivicFix</Link>
      </p>

      {!isSupabaseConfigured ? (
        <p className={styles.demoHint}>No Supabase credentials configured — admin sign-in is disabled.</p>
      ) : (
        <p className={styles.demoHint}>
          Demo account (provision it first with <code>node scripts/seed-admin.mjs</code>):
          <br />
          Email: <code>admin@civicfix.demo</code> · Password: <code>CivicFixDemo!2026</code>
          <br />
          Development/hackathon demo only — never deploy these credentials to production.
        </p>
      )}
    </form>
  );
}
