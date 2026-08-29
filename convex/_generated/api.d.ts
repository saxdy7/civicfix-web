/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as aiAssessments from "../aiAssessments.js";
import type * as assignments from "../assignments.js";
import type * as communityVotes from "../communityVotes.js";
import type * as crons from "../crons.js";
import type * as dailyAudit from "../dailyAudit.js";
import type * as departments from "../departments.js";
import type * as issueMedia from "../issueMedia.js";
import type * as issueMessages from "../issueMessages.js";
import type * as issues from "../issues.js";
import type * as lib_auth from "../lib/auth.js";
import type * as notifications from "../notifications.js";
import type * as push from "../push.js";
import type * as resolutionEvidence from "../resolutionEvidence.js";
import type * as staffAccessRequests from "../staffAccessRequests.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  aiAssessments: typeof aiAssessments;
  assignments: typeof assignments;
  communityVotes: typeof communityVotes;
  crons: typeof crons;
  dailyAudit: typeof dailyAudit;
  departments: typeof departments;
  issueMedia: typeof issueMedia;
  issueMessages: typeof issueMessages;
  issues: typeof issues;
  "lib/auth": typeof lib_auth;
  notifications: typeof notifications;
  push: typeof push;
  resolutionEvidence: typeof resolutionEvidence;
  staffAccessRequests: typeof staffAccessRequests;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
