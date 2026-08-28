import styles from "./Stat.module.css";

export interface StatProps {
  value: string;
  label: string;
  centered?: boolean;
  className?: string;
}

export function Stat({ value, label, centered, className }: StatProps) {
  const classes = [styles.stat, centered ? styles.centered : null, className]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes}>
      <span className={styles.value}>{value}</span>
      <span className={styles.label}>{label}</span>
    </div>
  );
}
