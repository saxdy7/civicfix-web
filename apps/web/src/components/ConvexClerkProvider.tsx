"use client";

import { ClerkProvider, useAuth } from "@clerk/nextjs";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import type { ReactNode } from "react";

import { convexClient, isConvexConfigured } from "@/lib/convex-client";

/**
 * Root provider — Clerk owns identity, Convex subscribes to it via
 * ConvexProviderWithClerk so every query/mutation automatically carries the
 * signed-in user's Clerk JWT. Requires a JWT template named "convex" in the
 * Clerk dashboard (JWT Templates -> New template -> Convex) — without it,
 * ctx.auth.getUserIdentity() in Convex functions returns null even for a
 * signed-in user, because the token's audience won't match
 * convex/auth.config.ts's applicationID.
 */
export function ConvexClerkProvider({ children }: { children: ReactNode }) {
  return (
    <ClerkProvider>
      {isConvexConfigured && convexClient ? (
        <ConvexProviderWithClerk client={convexClient} useAuth={useAuth}>
          {children}
        </ConvexProviderWithClerk>
      ) : (
        children
      )}
    </ClerkProvider>
  );
}
