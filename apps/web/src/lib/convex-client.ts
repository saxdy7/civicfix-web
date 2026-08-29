import { ConvexReactClient } from "convex/react";

// NEXT_PUBLIC_CONVEX_URL is printed by `npx convex dev` the first time you
// run it and link this repo to your Convex deployment — paste it into
// apps/web/.env.local. Until then this client has nothing to talk to.
const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

export const isConvexConfigured = Boolean(convexUrl);

export const convexClient = isConvexConfigured ? new ConvexReactClient(convexUrl as string) : null;
