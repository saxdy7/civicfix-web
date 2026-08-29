"use client";

import { useState } from "react";

import { Button } from "@civicfix/ui-web";

import { supabase } from "@/lib/supabase";

export function ConfirmButton({
  issueId,
  userId,
  isReporter,
  initialConfirmed,
  initialCount,
}: {
  issueId: string;
  userId: string | null;
  isReporter: boolean;
  initialConfirmed: boolean;
  initialCount: number;
}) {
  const [confirmed, setConfirmed] = useState(initialConfirmed);
  const [count, setCount] = useState(initialCount);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (isReporter) {
    return (
      <p style={{ margin: 0, fontSize: "var(--font-size-sm)", color: "var(--color-muted-foreground)" }}>
        {count} {count === 1 ? "neighbor has" : "neighbors have"} confirmed seeing this too.
      </p>
    );
  }

  if (!userId) {
    return (
      <p style={{ margin: 0, fontSize: "var(--font-size-sm)", color: "var(--color-muted-foreground)" }}>
        {count} {count === 1 ? "neighbor has" : "neighbors have"} confirmed this.{" "}
        <a href="/sign-in" style={{ color: "var(--color-civic-blue)" }}>
          Sign in
        </a>{" "}
        to confirm it too.
      </p>
    );
  }

  const handleToggle = async () => {
    if (!supabase) return;
    setBusy(true);
    setError(null);
    if (confirmed) {
      const { error: delError } = await supabase
        .from("confirmations")
        .delete()
        .eq("issue_id", issueId)
        .eq("user_id", userId);
      setBusy(false);
      if (delError) return setError(delError.message);
      setConfirmed(false);
      setCount((c) => Math.max(0, c - 1));
    } else {
      const { error: insError } = await supabase
        .from("confirmations")
        .insert({ issue_id: issueId, user_id: userId });
      setBusy(false);
      if (insError) return setError(insError.message);
      setConfirmed(true);
      setCount((c) => c + 1);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", alignItems: "flex-start" }}>
      <Button type="button" variant={confirmed ? "secondary" : "primary"} onClick={handleToggle} disabled={busy}>
        {confirmed ? "✓ You confirmed this" : "Seeing this too? Confirm it"}
      </Button>
      <p style={{ margin: 0, fontSize: "var(--font-size-xs)", color: "var(--color-muted-foreground)" }}>
        {count} {count === 1 ? "confirmation" : "confirmations"} so far.
      </p>
      {error ? (
        <p role="alert" style={{ margin: 0, fontSize: "var(--font-size-xs)", color: "var(--color-civic-red)" }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
