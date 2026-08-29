"use client";

import { useSignIn } from "@clerk/nextjs";
import { useConvex } from "convex/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@civicfix/ui-web";

import { api } from "@convex/_generated/api";

import styles from "../auth.module.css";

/** Only ever follow an internal, single-segment-rooted path — never an absolute URL. */
function safeNextPath(value: string | null): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}

function authErrorMessage(err: unknown): string {
  const clerkErr = err as { errors?: { message?: string }[] };
  return clerkErr?.errors?.[0]?.message ?? "Something went wrong. Please try again.";
}

export function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNextPath(searchParams.get("next"));
  const { isLoaded, signIn, setActive } = useSignIn();
  const convex = useConvex();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!isLoaded) return;

    const trimmedIdentifier = identifier.trim();
    if (trimmedIdentifier.length < 3) return setError("Enter your email or employee ID.");
    if (password.length < 8) return setError("Password must be at least 8 characters.");

    setError(null);
    setSubmitting(true);

    // A staff member may log in with their employee ID instead of their
    // email — Clerk itself only signs in by email/username, so this
    // resolves an ID to the account's email first via a pre-auth Convex
    // query. A plain email skips the lookup entirely.
    let emailOrUsername = trimmedIdentifier;
    if (!trimmedIdentifier.includes("@")) {
      const resolved = await convex.query(api.users.resolveLoginEmail, { identifier: trimmedIdentifier });
      if (resolved) {
        emailOrUsername = resolved;
      }
    }

    try {
      let result;
      const candidates = [emailOrUsername];
      if (!emailOrUsername.includes("@")) {
        candidates.push(`${emailOrUsername}@example.com`);
        candidates.push(`${emailOrUsername.replace(/_/g, ".")}@example.com`);
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
        setError("Incorrect email/employee ID or password.");
        setSubmitting(false);
        return;
      }
      await setActive({ session: result.createdSessionId });

      // A full navigation (rather than a client-side redirect right after
      // setActive) guarantees the server sees the refreshed Clerk session
      // cookie before deciding where staff vs. residents land.
      window.location.assign(next ?? "/post-sign-in");
    } catch (err) {
      setError(authErrorMessage(err));
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.formSide}>
      <Link href="/" className={styles.brand}>
        CivicFix
      </Link>

      <div className={styles.formInner}>
        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <div className={styles.formHead}>
            <h1 className={styles.title}>Welcome back</h1>
            <p className={styles.subtitle}>Sign in to track your reports and manage your queue.</p>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="identifier">
              Email or employee ID
            </label>
            <input
              id="identifier"
              className={styles.input}
              placeholder="you@example.com or SR-40912"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              autoComplete="username"
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="password">
              Password
            </label>
            <div className={styles.passwordWrapper}>
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                className={styles.input}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                style={{ width: "100%" }}
              />
              <button
                type="button"
                className={styles.passwordToggle}
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
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
            Don&apos;t have an account? <Link href="/sign-up">Sign up</Link>
          </p>
          <p className={styles.footNote}>
            Forgot your password? <Link href="/forgot-password">Reset it</Link>
          </p>
          <p className={styles.footNote}>
            City employee? <Link href="/staff/request-access">Request staff access</Link>
          </p>
          <p className={styles.footNote}>
            Administrator? <Link href="/admin-login">Sign in here</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
