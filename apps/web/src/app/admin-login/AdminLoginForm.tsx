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

  const handleLogin = async (userToUse: string, passToUse: string) => {
    if (!isLoaded) return;

    const trimmed = userToUse.trim();
    if (trimmed.length < 3) return setError("Enter your administrator username.");
    if (passToUse.length < 8) return setError("Enter your password.");

    setError(null);
    setSubmitting(true);

    const candidates = [trimmed];
    if (!trimmed.includes("@")) {
      candidates.push(`${trimmed}@example.com`);
      candidates.push(`${trimmed.replace(/_/g, ".")}@example.com`);
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
          window.location.assign(next ?? "/admin");
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
              window.location.assign(next ?? "/admin");
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

    const clerkErr = lastErr as { errors?: { message?: string }[] };
    setError(clerkErr?.errors?.[0]?.message ?? "Incorrect username or password.");
    setSubmitting(false);
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    handleLogin(username, password);
  };

  const fillAndLoginAdmin = () => {
    setUsername("civicfix_admin_demo");
    setPassword("CivicFixDemo!2026");
    handleLogin("civicfix_admin_demo", "CivicFixDemo!2026");
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

      <div
        style={{
          marginTop: "16px",
          padding: "12px",
          borderRadius: "8px",
          border: "1px dashed var(--color-border, #444)",
          background: "var(--color-surface, #111)",
          fontSize: "12px",
          color: "#aaa",
          lineHeight: 1.6,
        }}
      >
        <strong style={{ color: "#fff", display: "block", marginBottom: "6px" }}>
          ⚡ 1-Click Administrator Login:
        </strong>
        <button
          type="button"
          onClick={fillAndLoginAdmin}
          disabled={submitting}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "8px 12px",
            borderRadius: "6px",
            border: "1px solid var(--color-border, #333)",
            background: "var(--color-surface-muted, #1a1a1a)",
            color: "#fff",
            cursor: "pointer",
            fontSize: "12px",
            textAlign: "left",
          }}
        >
          <span>🛡️ <strong>Admin:</strong> civicfix_admin_demo</span>
          <span style={{ color: "var(--color-civic-green, #10b981)", fontWeight: 600 }}>Log In As Admin →</span>
        </button>
      </div>
    </form>
  );
}
