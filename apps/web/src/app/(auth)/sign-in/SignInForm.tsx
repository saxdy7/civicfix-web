"use client";

import { useClerk, useSignIn } from "@clerk/nextjs";
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

export function SignInForm() {
  const searchParams = useSearchParams();
  const next = safeNextPath(searchParams.get("next"));
  const { isLoaded, signIn, setActive } = useSignIn();
  const { signOut } = useClerk();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const attemptSignIn = async (id: string, pass: string): Promise<"ok" | "not_found" | string> => {
    try {
      try { await signOut(); } catch { /* ignore if no session */ }
      const created = await signIn!.create({ identifier: id, password: pass });
      if (created.status === "complete") {
        await setActive!({ session: created.createdSessionId });
        window.location.href = next ?? "/post-sign-in";
        return "ok";
      }
      if (created.status === "needs_first_factor") {
        const factor = await signIn!.attemptFirstFactor({ strategy: "password", password: pass });
        if (factor.status === "complete") {
          await setActive!({ session: factor.createdSessionId });
          window.location.href = next ?? "/post-sign-in";
          return "ok";
        }
      }
      return "Sign-in incomplete. Please try again.";
    } catch (err: unknown) {
      const clerkErr = err as { errors?: { code?: string; longMessage?: string; message?: string }[] };
      const code = clerkErr?.errors?.[0]?.code ?? "";
      const msg = clerkErr?.errors?.[0]?.longMessage ?? clerkErr?.errors?.[0]?.message ?? "Sign-in failed.";
      if (code === "form_identifier_not_found") return "not_found";
      return msg;
    }
  };

  const handleLogin = async (idToUse: string, passToUse: string) => {
    if (!isLoaded || !signIn) return;

    const trimmed = idToUse.trim();
    if (trimmed.length < 3) { setError("Enter your email or employee ID."); return; }
    if (passToUse.length < 8) { setError("Password must be at least 8 characters."); return; }

    setError(null);
    setSubmitting(true);

    // Try the identifier as-is first
    let result = await attemptSignIn(trimmed, passToUse);
    if (result === "ok") return;

    // If not found and looks like a username (no @), try appending @example.com
    if (result === "not_found" && !trimmed.includes("@")) {
      result = await attemptSignIn(`${trimmed}@example.com`, passToUse);
      if (result === "ok") return;
    }

    setError(result === "not_found" ? "No account found. Check the email and try again." : result);
    setSubmitting(false);
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    handleLogin(identifier, password);
  };

  const fillAndLogin = async (demoRole: "resident" | "worker" | "admin", demoEmail: string) => {
    if (!isLoaded || !signIn) return;
    setIdentifier(demoEmail);
    setPassword("••••••••••••••••");
    setError(null);
    setSubmitting(true);
    try {
      try { await signOut(); } catch { /* ignore if no session */ }
      const res = await fetch("/api/auth/demo-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: demoRole }),
      });
      const data = await res.json() as { token?: string; error?: string };
      if (!res.ok || !data.token) {
        setError(data.error ?? "Could not create demo session.");
        setSubmitting(false);
        return;
      }
      const result = await signIn.create({ strategy: "ticket", ticket: data.token });
      if (result.status === "complete") {
        await setActive!({ session: result.createdSessionId });
        window.location.href = next ?? "/post-sign-in";
        return;
      }
      setError("Demo sign-in incomplete — try again.");
    } catch (err: unknown) {
      const clerkErr = err as { errors?: { longMessage?: string; message?: string }[] };
      setError(clerkErr?.errors?.[0]?.longMessage ?? clerkErr?.errors?.[0]?.message ?? "Demo login failed.");
    }
    setSubmitting(false);
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

          <div id="clerk-captcha" />
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
                onClick={() => fillAndLogin("resident", "resident_demo@example.com")}
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
                onClick={() => fillAndLogin("worker", "worker_demo@example.com")}
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
                onClick={() => fillAndLogin("admin", "civicfix_admin_demo@example.com")}
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
