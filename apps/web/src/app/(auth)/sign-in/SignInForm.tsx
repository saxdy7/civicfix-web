"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@civicfix/ui-web";

import { authErrorMessage, isSupabaseConfigured, supabase } from "@/lib/supabase";

import styles from "../auth.module.css";

/** Only ever follow an internal, single-segment-rooted path — never an absolute URL. */
function safeNextPath(value: string | null): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}

export function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNextPath(searchParams.get("next"));
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    const trimmedIdentifier = identifier.trim();
    if (trimmedIdentifier.length < 3) return setError("Enter your email or employee ID.");
    if (password.length < 8) return setError("Password must be at least 8 characters.");

    setError(null);
    setSubmitting(true);

    if (!supabase) {
      // Preview mode — no credentials configured. Residents are the default.
      router.push(next ?? "/app");
      return;
    }

    // A staff member may log in with their employee ID instead of their
    // email — resolve it first (Supabase Auth itself only signs in by
    // email). A plain email skips the lookup entirely.
    let email = trimmedIdentifier;
    if (!trimmedIdentifier.includes("@")) {
      const { data: resolved } = await supabase.rpc("resolve_login_email", {
        p_identifier: trimmedIdentifier,
      });
      if (!resolved) {
        setError("Incorrect email/employee ID or password.");
        setSubmitting(false);
        return;
      }
      email = resolved;
    }

    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError(authErrorMessage(signInError));
      setSubmitting(false);
      return;
    }

    // Role decides the portal. Roles live in `user_roles` — never in user_metadata,
    // which the user can edit — so this read is the authoritative one.
    let destination = "/app";
    const userId = data.user?.id;

    if (userId) {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);

      const isStaff = (roles ?? []).some((r: { role: string }) =>
        ["field_worker", "department_manager", "administrator", "auditor"].includes(r.role),
      );
      if (isStaff) destination = "/admin";
    }

    // Middleware re-checks role on every request regardless, so honoring an
    // explicit `next` here (e.g. from /staff/request-access) is safe — worst
    // case a mismatched destination just gets redirected again server-side.
    router.push(next ?? destination);
    router.refresh();
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

          <Button type="submit" block disabled={submitting}>
            {submitting ? "Signing in…" : "Sign in"}
          </Button>

          <p className={styles.footNote}>
            Don&apos;t have an account? <Link href="/sign-up">Sign up</Link>
          </p>
          <p className={styles.footNote}>
            City employee? <Link href="/staff/request-access">Request staff access</Link>
          </p>
          <p className={styles.footNote}>
            Administrator? <Link href="/admin-login">Sign in here</Link>
          </p>

          {!isSupabaseConfigured ? (
            <p className={styles.demoHint}>
              Preview mode — no Supabase credentials configured, so any valid-looking email opens
              the resident portal.
            </p>
          ) : null}
        </form>
      </div>
    </div>
  );
}
