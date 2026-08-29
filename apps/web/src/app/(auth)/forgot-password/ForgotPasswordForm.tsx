"use client";

import { useSignIn } from "@clerk/nextjs";
import Link from "next/link";
import { useState, type FormEvent } from "react";

import { Button } from "@civicfix/ui-web";

import styles from "../auth.module.css";

function authErrorMessage(err: unknown): string {
  const clerkErr = err as { errors?: { message?: string }[] };
  return clerkErr?.errors?.[0]?.message ?? "Something went wrong. Please try again.";
}

export function ForgotPasswordForm() {
  const { isLoaded, signIn, setActive } = useSignIn();
  const [step, setStep] = useState<"request" | "reset" | "done">("request");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleRequest = async (event: FormEvent) => {
    event.preventDefault();
    if (!isLoaded) return;
    if (!email.includes("@")) return setError("Enter a valid email address.");

    setError(null);
    setSubmitting(true);
    try {
      await signIn.create({ strategy: "reset_password_email_code", identifier: email.trim() });
      setStep("reset");
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = async (event: FormEvent) => {
    event.preventDefault();
    if (!isLoaded) return;
    if (password.length < 8) return setError("Password must be at least 8 characters.");

    setError(null);
    setSubmitting(true);
    try {
      const result = await signIn.attemptFirstFactor({
        strategy: "reset_password_email_code",
        code: code.trim(),
        password,
      });
      if (result.status !== "complete") {
        setError("That code didn't work — check it and try again.");
        setSubmitting(false);
        return;
      }
      await setActive({ session: result.createdSessionId });
      setStep("done");
    } catch (err) {
      setError(authErrorMessage(err));
      setSubmitting(false);
    }
  };

  if (step === "done") {
    return (
      <div className={styles.formSide}>
        <Link href="/" className={styles.brand}>
          CivicFix
        </Link>
        <div className={styles.formInner}>
          <div className={styles.form}>
            <div className={styles.formHead}>
              <h1 className={styles.title}>Password updated</h1>
              <p className={styles.subtitle}>You&apos;re signed in with your new password.</p>
            </div>
            <Button type="button" block onClick={() => window.location.assign("/post-sign-in")}>
              Continue
            </Button>
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
        <form className={styles.form} onSubmit={step === "request" ? handleRequest : handleReset} noValidate>
          <div className={styles.formHead}>
            <h1 className={styles.title}>Reset your password</h1>
            <p className={styles.subtitle}>
              {step === "request"
                ? "We'll email you a code to reset your password."
                : `Enter the code we sent to ${email} and choose a new password.`}
            </p>
          </div>

          {step === "request" ? (
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
          ) : (
            <>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="code">
                  Reset code
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
              <div className={styles.field}>
                <label className={styles.label} htmlFor="password">
                  New password
                </label>
                <input
                  id="password"
                  type="password"
                  className={styles.input}
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
            </>
          )}

          {error ? (
            <p className={styles.errorText} role="alert">
              {error}
            </p>
          ) : null}

          <Button type="submit" block disabled={submitting || !isLoaded}>
            {submitting ? "Please wait…" : step === "request" ? "Send reset code" : "Set new password"}
          </Button>

          <p className={styles.footNote}>
            <Link href="/sign-in">Back to sign in</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
