import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import type { Session } from "@supabase/supabase-js";

import { isSupabaseConfigured, supabase } from "./supabase";

export type UserRole = "citizen" | "field_worker";

const STAFF_ROLES = ["field_worker", "department_manager", "administrator", "auditor"];

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  /** Every role row this account holds in `user_roles` — never client-editable. */
  roles: string[];
  /** Collapsed for the mobile UI's binary citizen/field-worker tab gating. */
  role: UserRole;
  /** True only in the local fallback used when Supabase isn't configured. */
  isDemo: boolean;
}

interface AuthContextValue {
  user: CurrentUser | null;
  /** True while the initial session/profile lookup is still in flight. */
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (
    email: string,
    password: string,
    fullName: string,
  ) => Promise<{ error: string | null; needsConfirmation: boolean }>;
  signOut: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<{ error: string | null }>;
  /** Only relevant when Supabase isn't configured — enters the demo fallback. */
  continueAsDemo: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function authErrorMessage(error: unknown): string {
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return "Something went wrong. Please try again.";
}

async function loadProfile(session: Session): Promise<CurrentUser> {
  if (!supabase) throw new Error("Supabase is not configured");

  const [{ data: profile }, { data: roleRows }] = await Promise.all([
    supabase.from("profiles").select("full_name, email").eq("id", session.user.id).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", session.user.id),
  ]);

  const roles = (roleRows ?? []).map((r) => r.role as string);

  return {
    id: session.user.id,
    // Never fall back to a raw email localpart as a "name" — it reads as a
    // broken username, not a greeting. A generic "Resident" is more honest.
    name: profile?.full_name?.trim() || "Resident",
    email: profile?.email || session.user.email || "",
    roles,
    role: roles.includes("field_worker") ? "field_worker" : "citizen",
    isDemo: false,
  };
}

const DEMO_USER: CurrentUser = {
  id: "demo-user",
  name: "Demo resident",
  email: "demo@civicfix.local",
  roles: ["citizen"],
  role: "citizen",
  isDemo: true,
};

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      // No Supabase configured at all — there is no session to restore, so
      // land on sign-in and let the user explicitly opt into the demo.
      setLoading(false);
      return;
    }

    let active = true;

    supabase.auth
      .getSession()
      .then(async ({ data: { session } }) => {
        if (!active) return;
        if (session) {
          try {
            setUser(await loadProfile(session));
          } catch {
            setUser(null);
          }
        }
      })
      .catch(() => {
        // A storage/network failure while restoring the session should land
        // the user on sign-in, never hang the app on a permanent spinner.
        if (active) setUser(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!active) return;
      if (!session) {
        setUser(null);
        return;
      }
      try {
        setUser(await loadProfile(session));
      } catch {
        setUser(null);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      signIn: async (email, password) => {
        if (!supabase) return { error: "Supabase is not configured." };
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        return { error: error ? authErrorMessage(error) : null };
      },
      signUp: async (email, password, fullName) => {
        if (!supabase) return { error: "Supabase is not configured.", needsConfirmation: false };
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName.trim() } },
        });
        if (error) return { error: authErrorMessage(error), needsConfirmation: false };
        return { error: null, needsConfirmation: !data.session };
      },
      signOut: async () => {
        if (user?.isDemo) {
          setUser(null);
          return;
        }
        await supabase?.auth.signOut();
        setUser(null);
      },
      requestPasswordReset: async (email) => {
        if (!supabase) return { error: "Supabase is not configured." };
        // Completing the loop (deep link back into the app to set a new
        // password) needs `civicfix://reset-password` added to this
        // Supabase project's Auth > URL Configuration redirect allow-list —
        // that's a dashboard setting, not something this client can set.
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: "civicfix://reset-password",
        });
        return { error: error ? authErrorMessage(error) : null };
      },
      continueAsDemo: () => {
        if (!isSupabaseConfigured) setUser(DEMO_USER);
      },
    }),
    [user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
