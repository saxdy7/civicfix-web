import { createContext, useContext, useMemo, useState, type PropsWithChildren } from "react";

export type UserRole = "citizen" | "field_worker";

export interface CurrentUser {
  name: string;
  email: string;
  role: UserRole;
}

interface AuthContextValue {
  user: CurrentUser | null;
  signIn: (email: string, role: UserRole) => void;
  signOut: () => void;
  setRole: (role: UserRole) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<CurrentUser | null>(null);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      signIn: (email, role) => setUser({ name: email.split("@")[0] || "Resident", email, role }),
      signOut: () => setUser(null),
      setRole: (role) => setUser((current) => (current ? { ...current, role } : current)),
    }),
    [user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
