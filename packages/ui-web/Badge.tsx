import type { HTMLAttributes } from "react";

import styles from "./Badge.module.css";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: "neutral" | "info" | "success" | "warning" | "danger";
}

export function Badge({ tone = "neutral", className, ...props }: BadgeProps) {
  const classes = [styles.badge, styles[tone], className].filter(Boolean).join(" ");
  return <span className={classes} {...props} />;
}
