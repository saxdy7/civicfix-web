"use client";

import { useSignUp } from "@clerk/nextjs";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@civicfix/ui-web";

import styles from "../auth.module.css";

function safeNextPath(value: string | null): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}

function authErrorMessage(err: unknown): string {
  const clerkErr = err as { errors?: { message?: string }[] };
  return clerkErr?.errors?.[0]?.message ?? "Something went wrong. Please try again.";
}

export function SignUpForm() {
  const searchParams = useSearchParams();
  const next = safeNextPath(searchParams.get("next"));
  const { isLoaded, signUp, setActive } = useSignUp();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [pendingCode, setPendingCode] = useState(false);
  const [code, setCode] = useState("");

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!isLoaded) return;

    if (name.trim().length < 2) return setError("Enter your name.");
    if (!email.includes("@")) return setError("Enter a valid email address.");
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    if (!agreed) return setError("Please accept the terms and privacy policy.");

    setError(null);
    setSubmitting(true);

    try {
      // Residents always sign up as `citizen` — Convex's ensureUser mutation
      // (called from /post-sign-in) is the only place a role is granted at
      // signup, and it never accepts one from the client.
      const [firstName, ...rest] = name.trim().split(" ");
      await signUp.create({ emailAddress: email.trim(), password, firstName, lastName: rest.join(" ") || undefined });
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setPendingCode(true);
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerify = async (event: FormEvent) => {
    event.preventDefault();
    if (!isLoaded) return;
    setError(null);
    setSubmitting(true);
    try {
      const result = await signUp.attemptEmailAddressVerification({ code: code.trim() });
      if (result.status !== "complete") {
        setError("That code didn't work — check it and try again.");
        setSubmitting(false);
        return;
      }
      await setActive({ session: result.createdSessionId });
      window.location.assign(next ?? "/post-sign-in");
    } catch (err) {
      setError(authErrorMessage(err));
      setSubmitting(false);
    }
  };

  if (pendingCode) {
    return (
      <div className={styles.formSide}>
        <Link href="/" className={styles.brand}>
          CivicFix
        </Link>
        <div className={styles.formInner}>
          <form className={styles.form} onSubmit={handleVerify} noValidate>
            <div className={styles.formHead}>
              <h1 className={styles.title}>Check your email</h1>
              <p className={styles.subtitle}>We sent a 6-digit code to {email}. Enter it below to finish creating your account.</p>
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="code">
                Verification code
              </label>
              <input
                id="code"
                className={styles.input}
                placeholder="123456"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                autoComplete="one-time-code"
                inputMode="numeric"
              />
            </div>
            {error ? (
              <p className={styles.errorText} role="alert">
                {error}
              </p>
            ) : null}
            <Button type="submit" block disabled={submitting}>
              {submitting ? "Verifying…" : "Verify and continue"}
            </Button>
          </form>
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

          <Button type="submit" block disabled={submitting || !isLoaded}>
            {submitting ? "Creating account…" : "Create account"}
          </Button>

          <p className={styles.footNote}>
            Already have an account? <Link href="/sign-in">Log in</Link>
          </p>
          <p className={styles.footNote}>
            City employee? <Link href="/staff/request-access">Request staff access</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
