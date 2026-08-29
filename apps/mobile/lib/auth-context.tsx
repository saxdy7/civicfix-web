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

        let emailOrUsername = identifier.trim();

        try {
          const result = await signIn.create({ identifier: emailOrUsername, password });
          if (result.status !== "complete") {
            return { error: "Additional verification is required for this account." };
          }
          await setActiveSignIn({ session: result.createdSessionId });
          return { error: null };
        } catch (err) {
          return { error: authErrorMessage(err) };
        }
      },
      signUp: async (email, password, fullName) => {
        if (!signUpLoaded || !signUp) {
          return { error: "Not ready yet — try again in a moment.", needsConfirmation: false };
        }
        try {
          // Residents always sign up as `citizen` — Convex's ensureUser
          // mutation above is the only place a role is granted at signup,
          // and it never accepts one from the client.
          const [firstName, ...rest] = fullName.trim().split(" ");
          await signUp.create({
            emailAddress: email.trim(),
            password,
            firstName,
            lastName: rest.join(" ") || undefined,
          });
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
