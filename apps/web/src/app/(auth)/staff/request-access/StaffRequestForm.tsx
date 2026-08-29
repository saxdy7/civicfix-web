"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";

import { Button } from "@civicfix/ui-web";

import { authErrorMessage, isSupabaseConfigured, supabase } from "@/lib/supabase";

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

interface StaffRequestFormProps {
  /** null when nobody is signed in — a request must be tied to an account. */
  session: { userId: string; email: string } | null;
  departments: { id: string; name: string }[];
}

export function StaffRequestForm({ session, departments }: StaffRequestFormProps) {
  const pending = session ? loadPending() : null;

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
  const [needsConfirmation, setNeedsConfirmation] = useState(false);

  // A confirmed signup lands back here already signed in — finish the
  // request it was waiting on without asking for anything twice.
  useEffect(() => {
    if (session && pending) {
      submitRequest(session.userId, pending.fullName, session.email, pending.employeeId, pending.departmentId, pending.role);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.userId]);

  async function submitRequest(
    userId: string,
    fullName: string,
    workEmail: string,
    empId: string,
    deptId: string,
    requestedRole: string,
  ) {
    if (!supabase) return;
    setSubmitting(true);
    const { error: insertError } = await supabase.from("staff_access_requests").insert({
      user_id: userId,
      full_name: fullName.trim(),
      work_email: workEmail.trim(),
      employee_id: empId.trim(),
      department_id: deptId,
      requested_role: requestedRole,
    });
    setSubmitting(false);
    window.sessionStorage.removeItem(PENDING_KEY);

    if (insertError) {
      setError(insertError.code === "23505" ? "You already have a pending request." : insertError.message);
      return;
    }
    setSubmitted(true);
  }

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

    if (!supabase || !isSupabaseConfigured) {
      setError("Requesting access isn't available in preview mode — Supabase isn't configured.");
      return;
    }

    if (session) {
      await submitRequest(session.userId, name, email, employeeId, departmentId, role);
      return;
    }

    // Not signed in yet: create the account and the request together so
    // this is one continuous flow instead of "sign up, then come back."
    setSubmitting(true);
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { full_name: name.trim() } },
    });

    if (signUpError) {
      setError(authErrorMessage(signUpError));
      setSubmitting(false);
      return;
    }

    if (data.session && data.user) {
      setSubmitting(false);
      await submitRequest(data.user.id, name, email, employeeId, departmentId, role);
      return;
    }

    // Email confirmation is required before a session exists — save what
    // was entered so nothing has to be retyped once they confirm and sign
    // back in here.
    const toSave: PendingRequest = { fullName: name.trim(), employeeId: employeeId.trim(), departmentId, role };
    window.sessionStorage.setItem(PENDING_KEY, JSON.stringify(toSave));
    setSubmitting(false);
    setNeedsConfirmation(true);
  };

  // A request is a row owned by the requester (RLS: user_id = auth.uid()),
  // so it can only be inserted once we have a real account — either an
  // existing one signing in, or a brand new one created right here.
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
                We sent a confirmation link to {email}. Open it, then{" "}
                <Link href="/sign-in?next=/staff/request-access">sign in here</Link> — your details are
                saved and your request finishes submitting automatically.
              </p>
            </div>
          </div>
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
