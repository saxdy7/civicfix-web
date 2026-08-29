"use client";

import { useEffect, useState } from "react";

import { Badge, Button } from "@civicfix/ui-web";

import styles from "./ApiStatus.module.css";

type Status = "checking" | "ok" | "error";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/v1";

async function pingHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/health`);
    return response.ok;
  } catch {
    return false;
  }
}

export function ApiStatus() {
  const [status, setStatus] = useState<Status>("checking");

  useEffect(() => {
    let active = true;
    pingHealth().then((ok) => {
      if (active) setStatus(ok ? "ok" : "error");
    });
    return () => {
      active = false;
    };
  }, []);

  const recheck = () => {
    setStatus("checking");
    pingHealth().then((ok) => setStatus(ok ? "ok" : "error"));
  };

  const tone = status === "ok" ? "success" : status === "error" ? "danger" : "neutral";
  const label =
    status === "ok"
      ? "FastAPI reachable"
      : status === "error"
        ? "FastAPI unreachable — site reads/writes Convex directly for now"
        : "Checking…";

  return (
    <div>
      <div className={styles.row}>
        <Badge tone={tone}>{label}</Badge>
        <Button variant="secondary" onClick={recheck} type="button">
          Recheck
        </Button>
      </div>
      <p className={styles.url}>{API_BASE_URL}/health</p>
    </div>
  );
}
