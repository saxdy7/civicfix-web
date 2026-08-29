"use client";

import { useSignIn } from "@clerk/nextjs";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@civicfix/ui-web";

import styles from "./admin-login.module.css";

function safeNextPath(value: string | null): string | null {
  if (!value || !value.startsWith("/admin")) return null;
  return value;
}

export function AdminLoginForm() {
  const searchParams = useSearchParams();
  const next = safeNextPath(searchParams.get("next"));
  const { isLoaded, signIn, setActive } = useSignIn();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!isLoaded) return;

    const trimmed = username.trim();
    if (trimmed.length < 3) return setError("Enter your administrator username.");
    if (password.length < 8) return setError("Enter your password.");

    setError(null);
    setSubmitting(true);

    try {
      let result;
      const candidates = [trimmed];
      if (!trimmed.includes("@")) {
        candidates.push(`${trimmed}@example.com`);
        candidates.push(`${trimmed.replace(/_/g, ".")}@example.com`);
      }

      let lastErr: unknown;
      for (const id of candidates) {
        try {
          result = await signIn.create({ identifier: id, password });
          if (result.status === "complete") break;
        } catch (err) {
          lastErr = err;
        }
      }

      if (!result || result.status !== "complete") {
        if (lastErr) throw lastErr;
        setError("Incorrect username or password.");
        setSubmitting(false);
        return;
      }
      await setActive({ session: result.createdSessionId });

      // Full navigation so the server sees the refreshed session before the
      // role check — /admin itself (via middleware) rejects anyone who
      // signs in here without the administrator role, signing them out of
      // this attempt rather than letting them into the console.
      window.location.assign(next ?? "/admin");
    } catch (err: unknown) {
      const clerkErr = err as { errors?: { message?: string }[] };
      setError(clerkErr?.errors?.[0]?.message ?? "Incorrect username or password.");
      setSubmitting(false);
    }
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
        <label className={styles.label} htmlFor="username">
          Username
        </label>
        <input
          id="username"
          className={styles.input}
          placeholder="e.g. civicfix_admin_demo"
          autoCapitalize="none"
          autoCorrect="off"
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
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

      <Button type="submit" block disabled={submitting || !isLoaded}>
        {submitting ? "Signing in…" : "Sign in"}
      </Button>

      <p className={styles.footNote}>
        <Link href="/">← Back to CivicFix</Link>
      </p>

      <p className={styles.demoHint}>
        Demo account (provision it first with <code>node scripts/seed-clerk-admin.mjs</code>):
        <br />
        Username: <code>civicfix_admin_demo</code> · Password: <code>CivicFixDemo!2026</code>
        <br />
        Development/hackathon demo only — never deploy these credentials to production.
      </p>
    </form>
  );
}
