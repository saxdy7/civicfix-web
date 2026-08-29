import { auth } from "@clerk/nextjs/server";
import { fetchMutation, fetchQuery } from "convex/nextjs";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";

const STAFF_ROLES = ["field_worker", "department_manager", "administrator", "auditor"];

export interface SessionProfile {
  userId: Id<"users">;
  name: string;
  email: string;
  roles: string[];
  isStaff: boolean;
  isAdmin: boolean;
  createdAt: string;
}

async function getConvexToken(): Promise<string | undefined> {
  const { getToken } = await auth();
  return (await getToken({ template: "convex" })) ?? undefined;
}

/** Resolves the signed-in Clerk user's Convex profile + roles, or null if unauthenticated. */
export async function getSessionProfile(): Promise<SessionProfile | null> {
  const { userId: clerkId } = await auth();
  if (!clerkId) return null;

  const token = await getConvexToken();
  const viewer = await fetchQuery(api.users.viewer, {}, { token });
  if (!viewer) return null;

  return {
    userId: viewer._id,
    name: viewer.fullName || viewer.email?.split("@")[0] || "Resident",
    email: viewer.email ?? "",
    roles: viewer.roles,
    isStaff: viewer.roles.some((r) => STAFF_ROLES.includes(r)),
    isAdmin: viewer.roles.includes("administrator"),
    createdAt: new Date(viewer.createdAt).toISOString(),
  };
}

/** Call once right after Clerk resolves a signed-in user (e.g. a client effect) to create/refresh their Convex profile. */
export async function ensureConvexUser(fullName?: string, email?: string) {
  const token = await getConvexToken();
  return await fetchMutation(api.users.ensureUser, { fullName, email }, { token });
}

/** For Server Components/Route Handlers that need to call any authenticated Convex query/mutation directly. */
export async function getConvexAuthToken(): Promise<string | undefined> {
  return await getConvexToken();
}
