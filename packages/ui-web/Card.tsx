import type { HTMLAttributes } from "react";

import styles from "./Card.module.css";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  tone?: "default" | "muted" | "inverse";
  flush?: boolean;
}

export function Card({ tone = "default", flush, className, ...props }: CardProps) {
  const toneClass = tone === "muted" ? styles.muted : tone === "inverse" ? styles.inverse : null;
  const classes = [styles.card, toneClass, flush ? styles.flush : null, className]
    .filter(Boolean)
    .join(" ");

  return <div className={classes} {...props} />;
}
