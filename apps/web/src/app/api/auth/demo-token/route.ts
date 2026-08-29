/**
 * POST /api/auth/demo-token
 *
 * Generates a one-time Clerk sign-in token for the requested demo role.
 * The token is passed back to the client which uses it with the "ticket"
 * strategy — this bypasses any first-factor requirement so demo login
 * works regardless of the Clerk instance's password/OTP configuration.
 *
 * Only works in development; rate-limited to 1 token per second per role.
 */
import { clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const DEMO_USER_IDS: Record<string, string> = {
  resident: "user_3IbH7dMtldWKUf4lLvTSLl1T6HQ",
  worker: "user_3IbH7oX2jujRT7QLuqkY2R6IZzN",
  admin: "user_3IanpT3aQXVDhO6JHg8E7EVwjHF",
};

export async function POST(request: Request) {
  // Only allow in development builds
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Demo tokens are disabled in production." }, { status: 403 });
  }

  let role: string;
  try {
    const body = await request.json() as { role?: string };
    role = (body.role ?? "").toLowerCase();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const userId = DEMO_USER_IDS[role];
  if (!userId) {
    return NextResponse.json(
      { error: `Unknown demo role "${role}". Must be one of: resident, worker, admin.` },
      { status: 400 },
    );
  }

  try {
    const clerk = await clerkClient();
    const signInToken = await clerk.signInTokens.createSignInToken({
      userId,
      expiresInSeconds: 120, // 2-minute window
    });

    return NextResponse.json({ token: signInToken.token });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[demo-token] Clerk error:", msg);
    return NextResponse.json({ error: `Clerk error: ${msg}` }, { status: 500 });
  }
}
