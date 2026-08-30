/**
 * POST /api/auth/demo-token
 *
 * Generates a one-time Clerk sign-in token for the requested demo role.
 * The token is passed back to the client which uses it with the "ticket"
 * strategy — this bypasses any first-factor requirement so demo login
 * works seamlessly on both local development and deployed demo environments.
 */
import { clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const DEMO_ACCOUNTS: Record<string, { email: string; name: string; role: string; fallbackUserId?: string }> = {
  resident: {
    email: "resident_demo@example.com",
    name: "Demo Resident",
    role: "resident",
    fallbackUserId: "user_3IbH7dMtldWKUf4lLvTSLl1T6HQ",
  },
  worker: {
    email: "worker_demo@example.com",
    name: "Demo Field Worker",
    role: "worker",
    fallbackUserId: "user_3IbH7oX2jujRT7QLuqkY2R6IZzN",
  },
  admin: {
    email: "civicfix_admin_demo@example.com",
    name: "City Administrator",
    role: "admin",
    fallbackUserId: "user_3IanpT3aQXVDhO6JHg8E7EVwjHF",
  },
};

export async function POST(request: Request) {
  let role: string;
  try {
    const body = (await request.json()) as { role?: string };
    role = (body.role ?? "").toLowerCase();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const accountInfo = DEMO_ACCOUNTS[role];
  if (!accountInfo) {
    return NextResponse.json(
      { error: `Unknown demo role "${role}". Must be one of: resident, worker, admin.` },
      { status: 400 },
    );
  }

  try {
    const clerk = await clerkClient();

    // 1. First try lookup by hardcoded ID if provided
    let targetUserId = accountInfo.fallbackUserId;
    if (targetUserId) {
      try {
        const user = await clerk.users.getUser(targetUserId);
        if (!user || user.id !== targetUserId) {
          targetUserId = undefined;
        }
      } catch {
        targetUserId = undefined;
      }
    }

    // 2. If ID lookup failed or wasn't present, search by email address
    if (!targetUserId) {
      const usersByEmail = await clerk.users.getUserList({
        emailAddress: [accountInfo.email],
        limit: 1,
      });

      const userList = (usersByEmail as any).data ?? usersByEmail;
      if (Array.isArray(userList) && userList.length > 0) {
        targetUserId = userList[0].id;
      }
    }

    // 3. If user does not exist in Clerk yet, create the demo user
    if (!targetUserId) {
      const createdUser = await clerk.users.createUser({
        emailAddress: [accountInfo.email],
        firstName: accountInfo.name.split(" ")[0],
        lastName: accountInfo.name.split(" ").slice(1).join(" ") || "Demo",
        publicMetadata: {
          role: accountInfo.role,
          isDemo: true,
        },
        skipPasswordRequirement: true,
      });
      targetUserId = createdUser.id;
    }

    // 4. Generate sign-in token
    const signInToken = await clerk.signInTokens.createSignInToken({
      userId: targetUserId,
      expiresInSeconds: 300, // 5-minute window
    });

    return NextResponse.json({ token: signInToken.token });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[demo-token] Clerk error:", msg);
    return NextResponse.json({ error: `Clerk demo login error: ${msg}` }, { status: 500 });
  }
}
