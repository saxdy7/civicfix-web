"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { Button } from "@civicfix/ui-web";

import { isSupabaseConfigured, supabase } from "@/lib/supabase";

import styles from "../../auth.module.css";

const ROLES = [
  { key: "field_worker", title: "Field worker", hint: "Accept assignments, capture evidence" },
  { key: "department_manager", title: "Dept. manager", hint: "Triage, route and assign" },
];

interface StaffRequestFormProps {
  /** null when nobody is signed in — a request must be tied to an account. */
  session: { userId: string; email: string } | null;
  departments: { id: string; name: string }[];
}

export function StaffRequestForm({ session, departments }: StaffRequestFormProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState(session?.email ?? "");
  const [employeeId, setEmployeeId] = useState("");
  const [departmentId, setDepartmentId] = useState(departments[0]?.id ?? "");
  const [role, setRole] = useState(ROLES[0].key);
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const departmentName = departments.find((d) => d.id === departmentId)?.name ?? "your department";

  // A request is a row owned by the requester (RLS: user_id = auth.uid()),
  // so there has to be a signed-in account to attach it to before this form
  // can do anything real.
  if (!session) {
    return (
      <div className={styles.formSide}>
        <Link href="/" className={styles.brand}>
          CivicFix
        </Link>
        <div className={styles.formInner}>
          <div className={styles.form}>
            <div className={styles.formHead}>
              <h1 className={styles.title}>Sign in first</h1>
              <p className={styles.subtitle}>
                A staff access request is tied to your account, so create a resident account or
                sign in before requesting elevated access.
              </p>
            </div>
            <Button
              type="button"
              block
              onClick={() => router.push("/sign-up?next=/staff/request-access")}
            >
              Create an account
            </Button>
            <Button
              type="button"
              variant="secondary"
              block
              onClick={() => router.push("/sign-in?next=/staff/request-access")}
            >
              I already have one — sign in
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (name.trim().length < 2) return setError("Enter your full name.");
    if (!email.includes("@")) return setError("Enter your work email address.");
    if (employeeId.trim().length < 3) return setError("Enter your employee ID.");
    if (!departmentId) return setError("Choose a department.");
    if (!agreed) return setError("You must accept the staff terms to request access.");

    setError(null);
    setSubmitting(true);

    if (!supabase || !isSupabaseConfigured) {
      setError("Requesting access isn't available in preview mode — Supabase isn't configured.");
      setSubmitting(false);
      return;
    }

    const { error: insertError } = await supabase.from("staff_access_requests").insert({
      user_id: session.userId,
      full_name: name.trim(),
      work_email: email.trim(),
      employee_id: employeeId.trim(),
      department_id: departmentId,
      requested_role: role,
    });

    if (insertError) {
      setError(
        insertError.code === "23505"
          ? "You already have a pending request."
          : insertError.message,
      );
      setSubmitting(false);
      return;
    }

    setSubmitted(true);
  };

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
                and assign your role. You will get an email at {email} once a decision is made.
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
              For city employees only. Residents should{" "}
              <Link href="/sign-up">create a resident account</Link> instead.
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
            />
          </div>

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
