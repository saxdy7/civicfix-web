"use client";

import { useSignIn } from "@clerk/nextjs";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@civicfix/ui-web";

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
  const searchParams = useSearchParams();
  const next = safeNextPath(searchParams.get("next"));
  const { isLoaded, signIn, setActive } = useSignIn();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleLogin = async (idToUse: string, passToUse: string) => {
    if (!isLoaded) return;

    const trimmedIdentifier = idToUse.trim();
    if (trimmedIdentifier.length < 3) return setError("Enter your email or employee ID.");
    if (passToUse.length < 8) return setError("Password must be at least 8 characters.");

    setError(null);
    setSubmitting(true);

    const candidates = [trimmedIdentifier];
    if (!trimmedIdentifier.includes("@")) {
      candidates.push(`${trimmedIdentifier}@example.com`);
      candidates.push(`${trimmedIdentifier.replace(/_/g, ".")}@example.com`);
    }

    let lastErr: unknown;
    for (const id of candidates) {
      try {
        let result = await signIn.create({ identifier: id, password: passToUse });
        if (result.status === "needs_first_factor") {
          result = await signIn.attemptFirstFactor({
            strategy: "password",
            password: passToUse,
          });
        }
        if (result.status === "complete") {
          await setActive({ session: result.createdSessionId });
          window.location.assign(next ?? "/post-sign-in");
          return;
        }
      } catch (err: unknown) {
        const clerkErr = err as { errors?: { code?: string; message?: string }[] };
        const code = clerkErr?.errors?.[0]?.code;
        if (code === "identifier_already_set" || code === "session_exists") {
          try {
            const factorRes = await signIn.attemptFirstFactor({
              strategy: "password",
              password: passToUse,
            });
            if (factorRes.status === "complete") {
              await setActive({ session: factorRes.createdSessionId });
              window.location.assign(next ?? "/post-sign-in");
              return;
            }
          } catch (factorErr) {
            lastErr = factorErr;
          }
        } else {
          lastErr = err;
        }
      }
    }

    if (lastErr) {
      setError(authErrorMessage(lastErr));
    } else {
      setError("Incorrect email/employee ID or password.");
    }
    setSubmitting(false);
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    handleLogin(identifier, password);
  };

  const fillAndLogin = (demoEmail: string, demoPass: string) => {
    setIdentifier(demoEmail);
    setPassword(demoPass);
    handleLogin(demoEmail, demoPass);
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

          <div
            style={{
              marginTop: "20px",
              padding: "14px",
              borderRadius: "8px",
              border: "1px dashed var(--color-border, #444)",
              background: "var(--color-surface, #111)",
              fontSize: "12px",
              color: "#aaa",
              lineHeight: 1.6,
            }}
          >
            <strong style={{ color: "#fff", display: "block", marginBottom: "8px" }}>
              ⚡ 1-Click Quick Demo Sign In:
            </strong>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <button
                type="button"
                onClick={() => fillAndLogin("resident_demo@example.com", "CivicFixDemo!2026")}
                disabled={submitting}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "6px 10px",
                  borderRadius: "6px",
                  border: "1px solid var(--color-border, #333)",
                  background: "var(--color-surface-muted, #1a1a1a)",
                  color: "#fff",
                  cursor: "pointer",
                  fontSize: "12px",
                  textAlign: "left",
                }}
              >
                <span>🏡 <strong>Resident:</strong> resident_demo@example.com</span>
                <span style={{ color: "var(--color-civic-green, #10b981)", fontWeight: 600 }}>Log In →</span>
              </button>

              <button
                type="button"
                onClick={() => fillAndLogin("worker_demo@example.com", "CivicFixDemo!2026")}
                disabled={submitting}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "6px 10px",
                  borderRadius: "6px",
                  border: "1px solid var(--color-border, #333)",
                  background: "var(--color-surface-muted, #1a1a1a)",
                  color: "#fff",
                  cursor: "pointer",
                  fontSize: "12px",
                  textAlign: "left",
                }}
              >
                <span>🛠️ <strong>Field Worker:</strong> worker_demo@example.com</span>
                <span style={{ color: "var(--color-civic-green, #10b981)", fontWeight: 600 }}>Log In →</span>
              </button>

              <button
                type="button"
                onClick={() => fillAndLogin("civicfix_admin_demo@example.com", "CivicFixDemo!2026")}
                disabled={submitting}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "6px 10px",
                  borderRadius: "6px",
                  border: "1px solid var(--color-border, #333)",
                  background: "var(--color-surface-muted, #1a1a1a)",
                  color: "#fff",
                  cursor: "pointer",
                  fontSize: "12px",
                  textAlign: "left",
                }}
              >
                <span>🛡️ <strong>Administrator:</strong> civicfix_admin_demo@example.com</span>
                <span style={{ color: "var(--color-civic-green, #10b981)", fontWeight: 600 }}>Log In →</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
