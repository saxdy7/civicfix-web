import type { HTMLAttributes } from "react";

import styles from "./Eyebrow.module.css";

export interface EyebrowProps extends HTMLAttributes<HTMLSpanElement> {
  centered?: boolean;
}

export function Eyebrow({ centered, className, ...props }: EyebrowProps) {
  const classes = [styles.eyebrow, centered ? styles.centered : null, className]
    .filter(Boolean)
    .join(" ");
  return <span className={classes} {...props} />;
}
