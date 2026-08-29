import type { Metadata } from "next";
import { Suspense } from "react";

import { AdminLoginForm } from "./AdminLoginForm";
import styles from "./admin-login.module.css";

export const metadata: Metadata = {
  title: "Administrator sign in · CivicFix",
};

export default function AdminLoginPage() {
  return (
    <div className={styles.shell}>
      <Suspense fallback={null}>
        <AdminLoginForm />
      </Suspense>
    </div>
  );
}
