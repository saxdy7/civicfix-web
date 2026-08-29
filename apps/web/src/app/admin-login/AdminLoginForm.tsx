"use client";

import { useClerk, useSignIn } from "@clerk/nextjs";
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
  const { signOut } = useClerk();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const attemptSignIn = async (id: string, pass: string): Promise<"ok" | "not_found" | string> => {
    try {
      try { await signOut(); } catch { /* ignore */ }
      const created = await signIn!.create({ identifier: id, password: pass });
      if (created.status === "complete") {
        await setActive!({ session: created.createdSessionId });
        window.location.href = next ?? "/admin";
        return "ok";
      }
      if (created.status === "needs_first_factor") {
        const factor = await signIn!.attemptFirstFactor({ strategy: "password", password: pass });
        if (factor.status === "complete") {
          await setActive!({ session: factor.createdSessionId });
          window.location.href = next ?? "/admin";
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

  const handleLogin = async (userToUse: string, passToUse: string) => {
    if (!isLoaded || !signIn) return;

    const trimmed = userToUse.trim();
    if (trimmed.length < 3) { setError("Enter your administrator username."); return; }
    if (passToUse.length < 8) { setError("Enter your password."); return; }

    setError(null);
    setSubmitting(true);

    // Try as-is first (works if full email entered)
    let result = await attemptSignIn(trimmed, passToUse);
    if (result === "ok") return;

    // If not found and no @, try appending @example.com (username mode)
    if (result === "not_found" && !trimmed.includes("@")) {
      result = await attemptSignIn(`${trimmed}@example.com`, passToUse);
      if (result === "ok") return;
    }

    setError(result === "not_found" ? "No admin account found with that username." : result);
    setSubmitting(false);
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    handleLogin(username, password);
  };

  const fillAndLoginAdmin = async () => {
    if (!isLoaded || !signIn) return;
    setUsername("civicfix_admin_demo");
    setPassword("••••••••••••••••");
    setError(null);
    setSubmitting(true);
    try {
      try { await signOut(); } catch { /* ignore */ }
      const res = await fetch("/api/auth/demo-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "admin" }),
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
        window.location.href = next ?? "/admin";
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

      <div id="clerk-captcha" />
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
