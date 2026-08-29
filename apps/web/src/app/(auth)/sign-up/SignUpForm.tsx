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

export function SignUpForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNextPath(searchParams.get("next"));
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (name.trim().length < 2) return setError("Enter your name.");
    if (!email.includes("@")) return setError("Enter a valid email address.");
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    if (!agreed) return setError("Please accept the terms and privacy policy.");

    setError(null);
    setSubmitting(true);

    if (!supabase) {
      router.push(next ?? "/app");
      return;
    }

    // Residents always sign up as `citizen`. Role is assigned server-side by a
    // trigger — never from this client — so it cannot be elevated here.
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name.trim() },
        emailRedirectTo: `${window.location.origin}${next ?? "/app"}`,
      },
    });

    if (signUpError) {
      setError(authErrorMessage(signUpError));
      setSubmitting(false);
      return;
    }

    if (data.session) {
      router.push(next ?? "/app");
      router.refresh();
    } else {
      setNeedsConfirmation(true);
      setSubmitting(false);
    }
  };

  if (needsConfirmation) {
    return (
      <div className={styles.formSide}>
        <Link href="/" className={styles.brand}>
          CivicFix
        </Link>
        <div className={styles.formInner}>
          <div className={styles.form}>
            <div className={styles.formHead}>
              <h1 className={styles.title}>Check your email</h1>
              <p className={styles.subtitle}>
                We sent a confirmation link to {email}. Open it to activate your account, then
                sign in.
              </p>
            </div>
            <Link href="/sign-in" style={{ textAlign: "center", fontWeight: 600 }}>
              Back to sign in
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.formSide}>
      <Link href="/" className={styles.brand}>
        CivicFix
      </Link>

      <div className={styles.formInner}>
        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <div className={styles.formHead}>
            <h1 className={styles.title}>Create your account</h1>
            <p className={styles.subtitle}>Report an issue and follow it through to resolution.</p>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="name">
              Name
            </label>
            <input
              id="name"
              className={styles.input}
              placeholder="Enter your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
            />
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
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
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

          <label className={styles.checkboxRow}>
            <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
            <span>I agree to the Terms, Privacy Policy, and consented location collection.</span>
          </label>

          {error ? (
            <p className={styles.errorText} role="alert">
              {error}
            </p>
          ) : null}

          <Button type="submit" block disabled={submitting}>
            {submitting ? "Creating account…" : "Create account"}
          </Button>

          <p className={styles.footNote}>
            Already have an account? <Link href="/sign-in">Log in</Link>
          </p>
          <p className={styles.footNote}>
            City employee? <Link href="/staff/request-access">Request staff access</Link>
          </p>

          {!isSupabaseConfigured ? (
            <p className={styles.demoHint}>
              Preview mode — no Supabase credentials configured, so no real account is created.
            </p>
          ) : null}
        </form>
      </div>
    </div>
  );
}
