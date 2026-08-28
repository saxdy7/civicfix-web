import type { ButtonHTMLAttributes } from "react";

import styles from "./Button.module.css";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost";
  block?: boolean;
}

export function Button({ variant = "primary", block, className, ...props }: ButtonProps) {
  const classes = [styles.button, styles[variant], block ? styles.block : null, className]
    .filter(Boolean)
    .join(" ");

  return <button className={classes} {...props} />;
}
