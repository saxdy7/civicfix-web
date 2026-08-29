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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!email.includes("@")) return setError("Enter a valid email address.");
    if (password.length < 8) return setError("Password must be at least 8 characters.");

    setError(null);
    setSubmitting(true);

    if (!supabase) {
      // Preview mode — no credentials configured. Residents are the default.
      router.push(next ?? "/app");
      return;
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
            <label className={styles.label} htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              className={styles.input}
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
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
