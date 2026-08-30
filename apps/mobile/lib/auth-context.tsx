import { useAuth as useClerkAuth, useSignIn, useSignUp, useUser } from "@clerk/clerk-expo";
import { useConvex, useMutation, useQuery } from "convex/react";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";

import { isConvexConfigured } from "./convex-client";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

export type UserRole = "citizen" | "field_worker";

export interface CurrentUser {
  id: Id<"users">;
  name: string;
  email: string;
  /** Every role row this account holds — never client-editable. */
  roles: string[];
  /** Collapsed for the mobile UI's binary citizen/field-worker tab gating. */
  role: UserRole;
  /** True only in the local fallback used when Clerk/Convex aren't configured. */
  isDemo: boolean;
}

interface AuthContextValue {
  user: CurrentUser | null;
  /** True while the initial session/profile lookup is still in flight. */
  loading: boolean;
  /** `identifier` may be an email or a staff employee ID — resolved to an email before signing in. */
  signIn: (identifier: string, password: string) => Promise<{ error: string | null }>;
  signUp: (
    email: string,
    password: string,
    fullName: string,
  ) => Promise<{ error: string | null; needsConfirmation: boolean }>;
  /** Completes a sign-up started by signUp — the 6-digit code sent to the new account's email. */
  confirmSignUp: (code: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  /** Sends a 6-digit reset code to the given email. */
  requestPasswordReset: (email: string) => Promise<{ error: string | null }>;
  /** Completes a reset started by requestPasswordReset. */
  confirmPasswordReset: (code: string, newPassword: string) => Promise<{ error: string | null }>;
  /** 1-click Demo sign-in for testing resident, worker, and admin roles. */
  signInWithDemoRole: (role: "resident" | "worker" | "admin") => Promise<{ error: string | null }>;
  /** Only relevant when Clerk isn't configured — enters the demo fallback. */
  continueAsDemo: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function authErrorMessage(err: unknown): string {
  const clerkErr = err as { errors?: { message?: string }[] };
  return clerkErr?.errors?.[0]?.message ?? "Something went wrong. Please try again.";
}

const DEMO_USER: CurrentUser = {
  id: "demo-user" as Id<"users">,
  name: "Demo resident",
  email: "demo@civicfix.local",
  roles: ["citizen"],
  role: "citizen",
  isDemo: true,
};

// ClerkAuthProvider below calls Convex hooks unconditionally, so the real
// path requires BOTH Clerk and Convex configured together — see
// app/_layout.tsx's BackendProviders, which only mounts
// ConvexProviderWithClerk (and therefore only ever renders this branch)
// when both are present.
const isBackendConfigured = Boolean(process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY) && isConvexConfigured;

/** Used when Clerk/Convex aren't fully configured — there is no session to restore, only the demo fallback. */
function DemoOnlyAuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<CurrentUser | null>(null);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading: false,
      signIn: async () => ({ error: "Sign-in isn't available in demo mode — Clerk isn't configured." }),
      signUp: async () => ({
        error: "Sign-up isn't available in demo mode — Clerk isn't configured.",
        needsConfirmation: false,
      }),
      confirmSignUp: async () => ({ error: "Not available in demo mode." }),
      signOut: async () => setUser(null),
      requestPasswordReset: async () => ({ error: "Not available in demo mode." }),
      confirmPasswordReset: async () => ({ error: "Not available in demo mode." }),
      signInWithDemoRole: async (demoRole) => {
        setUser({
          id: `demo-${demoRole}` as Id<"users">,
          name: demoRole === "worker" ? "Demo Field Worker" : demoRole === "admin" ? "Demo Administrator" : "Demo Resident",
          email: `${demoRole}_demo@civicfix.local`,
          roles: [demoRole === "worker" ? "field_worker" : demoRole === "admin" ? "administrator" : "citizen"],
          role: demoRole === "worker" ? "field_worker" : "citizen",
          isDemo: true,
        });
        return { error: null };
      },
      continueAsDemo: () => setUser(DEMO_USER),
    }),
    [user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * The real path — Clerk owns identity, Convex holds the profile/roles.
 * Only ever mounted inside <ClerkProvider>/<ConvexProviderWithClerk> (see
 * app/_layout.tsx) — every hook here assumes that context is present.
 */
function ClerkAuthProvider({ children }: PropsWithChildren) {
  const { isLoaded: authLoaded, isSignedIn, signOut: clerkSignOut } = useClerkAuth();
  const { user: clerkUser } = useUser();
  const { isLoaded: signInLoaded, signIn, setActive: setActiveSignIn } = useSignIn();
  const { isLoaded: signUpLoaded, signUp, setActive: setActiveSignUp } = useSignUp();
  const convex = useConvex();

  const viewer = useQuery(api.users.viewer, isSignedIn ? {} : "skip");
  const ensureUser = useMutation(api.users.ensureUser);

  // Syncs the Clerk identity into Convex's `users` table right after sign-in
  // — keyed on the Clerk user id so it re-runs for a genuinely new sign-in
  // (including signing out and back in as someone else) but not on every
  // render.
  const [ensuredFor, setEnsuredFor] = useState<string | null>(null);
  useEffect(() => {
    if (!isSignedIn) {
      setEnsuredFor(null);
      return;
    }
    if (clerkUser && ensuredFor !== clerkUser.id) {
      setEnsuredFor(clerkUser.id);
      ensureUser({
        fullName: clerkUser.fullName ?? undefined,
        email: clerkUser.primaryEmailAddress?.emailAddress ?? undefined,
      }).catch(() => setEnsuredFor(null));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSignedIn, clerkUser?.id]);

  const loading = !authLoaded || (isSignedIn === true && viewer === undefined);

  const user: CurrentUser | null = useMemo(() => {
    if (!isSignedIn || !viewer) return null;
    return {
      id: viewer._id,
      name: viewer.fullName?.trim() || "Resident",
      email: viewer.email ?? "",
      roles: viewer.roles,
      role: viewer.roles.includes("field_worker") ? "field_worker" : "citizen",
      isDemo: false,
    };
  }, [isSignedIn, viewer]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      signIn: async (identifier, password) => {
        if (!signInLoaded || !signIn) return { error: "Not ready yet — try again in a moment." };

        const trimmed = identifier.trim();
        const candidates = [trimmed];
        if (!trimmed.includes("@")) {
          candidates.push(`${trimmed}@example.com`);
          candidates.push(`${trimmed.replace(/_/g, ".")}@example.com`);
        }

        let lastErr: unknown;
        for (const id of candidates) {
          try {
            let result = await signIn.create({ identifier: id, password });
            if (result.status === "needs_first_factor") {
              result = await signIn.attemptFirstFactor({ strategy: "password", password });
            }
            if (result.status === "complete") {
              await setActiveSignIn({ session: result.createdSessionId });
              return { error: null };
            }
          } catch (err: unknown) {
            const clerkErr = err as { errors?: { code?: string; message?: string }[] };
            const code = clerkErr?.errors?.[0]?.code;
            if (code === "identifier_already_set" || code === "session_exists") {
              try {
                const factorRes = await signIn.attemptFirstFactor({ strategy: "password", password });
                if (factorRes.status === "complete") {
                  await setActiveSignIn({ session: factorRes.createdSessionId });
                  return { error: null };
                }
              } catch (factorErr) {
                lastErr = factorErr;
              }
            } else {
              lastErr = err;
            }
          }
        }

        return { error: lastErr ? authErrorMessage(lastErr) : "Incorrect email or password." };
      },
      signUp: async (email, password, fullName) => {
        if (!signUpLoaded || !signUp) {
          return { error: "Not ready yet — try again in a moment.", needsConfirmation: false };
        }
        try {
          // Residents always sign up as `citizen` — Convex's ensureUser
          // mutation above is the only place a role is granted at signup.
          const [firstName, ...rest] = fullName.trim().split(" ");
          const result = await signUp.create({
            emailAddress: email.trim(),
            password,
            firstName,
            lastName: rest.join(" ") || undefined,
          });
          if (result.status === "complete") {
            await setActiveSignUp({ session: result.createdSessionId });
            return { error: null, needsConfirmation: false };
          }
          await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
          return { error: null, needsConfirmation: true };
        } catch (err) {
          return { error: authErrorMessage(err), needsConfirmation: false };
        }
      },
      confirmSignUp: async (code) => {
        if (!signUpLoaded || !signUp) return { error: "Not ready yet — try again in a moment." };
        try {
          const result = await signUp.attemptEmailAddressVerification({ code: code.trim() });
          if (result.status !== "complete") {
            return { error: "That code didn't work — check it and try again." };
          }
          await setActiveSignUp({ session: result.createdSessionId });
          return { error: null };
        } catch (err) {
          return { error: authErrorMessage(err) };
        }
      },
      signOut: async () => {
        await clerkSignOut();
      },
      requestPasswordReset: async (email) => {
        if (!signInLoaded || !signIn) return { error: "Not ready yet — try again in a moment." };
        try {
          await signIn.create({ strategy: "reset_password_email_code", identifier: email.trim() });
          return { error: null };
        } catch (err) {
          return { error: authErrorMessage(err) };
        }
      },
      confirmPasswordReset: async (code, newPassword) => {
        if (!signInLoaded || !signIn) return { error: "Not ready yet — try again in a moment." };
        try {
          const result = await signIn.attemptFirstFactor({
            strategy: "reset_password_email_code",
            code: code.trim(),
            password: newPassword,
          });
          if (result.status !== "complete") {
            return { error: "That code didn't work — check it and try again." };
          }
          await setActiveSignIn({ session: result.createdSessionId });
          return { error: null };
        } catch (err) {
          return { error: authErrorMessage(err) };
        }
      },
      signInWithDemoRole: async (demoRole) => {
        if (!signInLoaded || !signIn) return { error: "Not ready yet — try again in a moment." };
        try {
          try { await clerkSignOut(); } catch { /* ignore */ }
          const candidateUrls = [
            "http://10.33.3.78:3000/api/auth/demo-token",
            "http://localhost:3000/api/auth/demo-token",
            "http://127.0.0.1:3000/api/auth/demo-token",
          ];
          let token: string | null = null;
          for (const u of candidateUrls) {
            try {
              const res = await fetch(u, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ role: demoRole }),
              });
              if (res.ok) {
                const data = await res.json();
                if (data.token) {
                  token = data.token;
                  break;
                }
              }
            } catch {
              // Try next URL
            }
          }

          if (token) {
            const result = await signIn.create({ strategy: "ticket", ticket: token });
            if (result.status === "complete") {
              await setActiveSignIn({ session: result.createdSessionId });
              return { error: null };
            }
          }

          // If web server token endpoint wasn't reached, try standard password fallback
          const pass = "CivicFixDemo!2026";
          const emailMap = {
            resident: "resident_demo@example.com",
            worker: "worker_demo@example.com",
            admin: "civicfix_admin_demo@example.com",
          };
          const fallbackRes = await signIn.create({ identifier: emailMap[demoRole], password: pass });
          if (fallbackRes.status === "complete") {
            await setActiveSignIn({ session: fallbackRes.createdSessionId });
            return { error: null };
          }

          return { error: "Could not create demo session. You can also sign up with a new email." };
        } catch (err) {
          return { error: authErrorMessage(err) };
        }
      },
      continueAsDemo: () => {
        // Not applicable once Clerk is configured — the sign-in screen never
        // shows this option in that case.
      },
    }),
    [
      user,
      loading,
      signInLoaded,
      signIn,
      signUpLoaded,
      signUp,
      convex,
      clerkSignOut,
      setActiveSignIn,
      setActiveSignUp,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function AuthProvider({ children }: PropsWithChildren) {
  if (!isBackendConfigured) return <DemoOnlyAuthProvider>{children}</DemoOnlyAuthProvider>;
  return <ClerkAuthProvider>{children}</ClerkAuthProvider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
