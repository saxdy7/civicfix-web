"use client";

import { useClerk, useSignUp } from "@clerk/nextjs";
import { useMutation } from "convex/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import { Button } from "@civicfix/ui-web";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";

import styles from "../../auth.module.css";

const ROLES = [
  { key: "field_worker", title: "Field worker", hint: "Accept assignments, capture evidence" },
  { key: "department_manager", title: "Dept. manager", hint: "Triage, route and assign" },
];

const PENDING_KEY = "civicfix-pending-staff-request";

interface PendingRequest {
  fullName: string;
  employeeId: string;
  departmentId: string;
  role: string;
}

function loadPending(): PendingRequest | null {
  try {
    const raw = window.sessionStorage.getItem(PENDING_KEY);
    return raw ? (JSON.parse(raw) as PendingRequest) : null;
  } catch {
    return null;
  }
}

function authErrorMessage(err: unknown): string {
  const clerkErr = err as { errors?: { message?: string }[] };
  return clerkErr?.errors?.[0]?.message ?? "Something went wrong. Please try again.";
}

interface StaffRequestFormProps {
  /** null when nobody is signed in — a request must be tied to an account. */
  session: { userId: string; email: string } | null;
  departments: { id: string; name: string }[];
}

export function StaffRequestForm({ session, departments }: StaffRequestFormProps) {
  const router = useRouter();
  const { signOut } = useClerk();
  const { isLoaded, signUp, setActive } = useSignUp();
  const submitAccessRequest = useMutation(api.staffAccessRequests.submit);

  const pending = session ? loadPending() : null;
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    setSigningOut(true);
    await signOut();
    router.refresh();
  };

  const [name, setName] = useState(pending?.fullName ?? "");
  const [email, setEmail] = useState(session?.email ?? "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [employeeId, setEmployeeId] = useState(pending?.employeeId ?? "");
  const [departmentId, setDepartmentId] = useState(pending?.departmentId ?? departments[0]?.id ?? "");
  const [role, setRole] = useState(pending?.role ?? ROLES[0].key);
  const [agreed, setAgreed] = useState(Boolean(pending));
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [pendingCode, setPendingCode] = useState(false);
  const [code, setCode] = useState("");

  async function submitRequest(
    fullName: string,
    workEmail: string,
    empId: string,
    deptId: string,
    requestedRole: string,
  ) {
    setSubmitting(true);
    setError(null);
    try {
      await submitAccessRequest({
        fullName: fullName.trim(),
        workEmail: workEmail.trim(),
        employeeId: empId.trim(),
        departmentId: deptId ? (deptId as Id<"departments">) : undefined,
        requestedRole: requestedRole as "field_worker" | "department_manager",
      });
      window.sessionStorage.removeItem(PENDING_KEY);
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit this request.");
    } finally {
      setSubmitting(false);
    }
  }

  // A confirmed signup lands back here already signed in — finish the
  // request it was waiting on without asking for anything twice.
  useEffect(() => {
    if (session && pending) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time auto-submit of a request saved before email verification, not a render-driven state sync
      submitRequest(pending.fullName, session.email, pending.employeeId, pending.departmentId, pending.role);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.userId]);

  const departmentName = departments.find((d) => d.id === departmentId)?.name ?? "your department";

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (name.trim().length < 2) return setError("Enter your full name.");
    if (!email.includes("@")) return setError("Enter your work email address.");
    if (!session && password.length < 8) return setError("Password must be at least 8 characters.");
    if (employeeId.trim().length < 3) return setError("Enter your employee ID.");
    if (!departmentId) return setError("Choose a department.");
    if (!agreed) return setError("You must accept the staff terms to request access.");

    setError(null);

    if (session) {
      await submitRequest(name, email, employeeId, departmentId, role);
      return;
    }

    if (!isLoaded) return;

    // Not signed in yet: create the account, then finish the request once
    // the verification code confirms it — one continuous flow instead of
    // "sign up, then come back."
    setSubmitting(true);
    try {
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

      const toSave: PendingRequest = { fullName: name.trim(), employeeId: employeeId.trim(), departmentId, role };
      window.sessionStorage.setItem(PENDING_KEY, JSON.stringify(toSave));

      await setActive({ session: result.createdSessionId });
      // A full navigation guarantees the server sees the fresh Clerk session
      // cookie before this page re-renders with `session` populated — the
      // effect above then finishes submitting the saved request automatically.
      window.location.assign("/staff/request-access");
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
              <p className={styles.subtitle}>
                We sent a 6-digit code to {email}. Enter it below to finish creating your account and
                submit your request.
              </p>
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

  if (submitted) {
    return (
      <div className={styles.formSide}>
        <Link href="/" className={styles.brand}>
          CivicFix
        </Link>
        <div className={styles.formInner}>
          <div className={styles.form}>
            <div className={styles.formHead}>
              <h1 className={styles.title}>Request received</h1>
              <p className={styles.subtitle}>
                An administrator will verify your employee ID against the {departmentName} roster
                and assign your role. Once approved, you can sign in with your email or your
                employee ID.
              </p>
            </div>
            <Link href="/" style={{ textAlign: "center", fontWeight: 600 }}>
              Back to home
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
            <h1 className={styles.title}>Request staff access</h1>
            <p className={styles.subtitle}>
              For city employees only. Not staff?{" "}
              <Link href="/sign-up">Create a resident account</Link> instead.
            </p>
          </div>

          {session ? (
            <div
              className={styles.checkboxRow}
              style={{
                alignItems: "center",
                background: "var(--color-surface-muted)",
                borderRadius: "var(--radius-control)",
                padding: "var(--space-3)",
              }}
            >
              <span>
                Signed in as <strong>{session.email}</strong> — this request attaches to that
                account, so there&apos;s no password to enter here.{" "}
                <button
                  type="button"
                  onClick={handleSignOut}
                  disabled={signingOut}
                  style={{
                    background: "none",
                    border: "none",
                    padding: 0,
                    color: "var(--color-civic-blue)",
                    textDecoration: "underline",
                    cursor: "pointer",
                    font: "inherit",
                  }}
                >
                  {signingOut ? "Signing out…" : "Not you? Sign out"}
                </button>
              </span>
            </div>
          ) : null}

          <div className={styles.field}>
            <label className={styles.label} htmlFor="name">
              Full name
            </label>
            <input
              id="name"
              className={styles.input}
              placeholder="Enter your full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="email">
              Work email
            </label>
            <input
              id="email"
              type="email"
              className={styles.input}
              placeholder="you@city.gov"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              disabled={Boolean(session)}
            />
          </div>

          {!session ? (
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
          ) : null}

          <div className={styles.field}>
            <label className={styles.label} htmlFor="employeeId">
              Employee ID
            </label>
            <input
              id="employeeId"
              className={styles.input}
              placeholder="e.g. SR-40912"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="department">
              Department
            </label>
            <select
              id="department"
              className={styles.input}
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
            >
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.field}>
            <span className={styles.label}>Requested role</span>
            <div className={styles.roleGroup}>
              {ROLES.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  className={`${styles.roleOption} ${role === option.key ? styles.roleOptionActive : ""}`}
                  onClick={() => setRole(option.key)}
                  aria-pressed={role === option.key}
                >
                  <span className={styles.roleOptionTitle}>{option.title}</span>
                  <span className={styles.roleOptionHint}>{option.hint}</span>
                </button>
              ))}
            </div>
          </div>

          <label className={styles.checkboxRow}>
            <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
            <span>
              I confirm I am an employee of this municipality and accept the staff terms: I will
              access reporter data only as needed for my duties, will not export or share it, and
              understand that every privileged action I take is permanently audit-logged.
            </span>
          </label>

          {error ? (
            <p className={styles.errorText} role="alert">
              {error}
            </p>
          ) : null}

          <Button type="submit" block disabled={submitting}>
            {submitting ? "Submitting…" : "Submit request"}
          </Button>

          <p className={styles.footNote}>
            Already approved? <Link href="/sign-in">Sign in</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
