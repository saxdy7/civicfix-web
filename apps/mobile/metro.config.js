// Monorepo-aware Metro config. apps/mobile isn't an npm workspace member,
// but it needs to import the shared Convex backend's generated API/types
// from the repo-root `convex/` folder (see lib/convex-client.ts and
// lib/auth-context.tsx) — the same generated client both apps.web and
// apps/mobile treat as the single source of truth, never a copy. Metro's
// default project root is this folder alone, so without widening
// watchFolders/nodeModulesPaths a relative import reaching outside
// apps/mobile fails to resolve.
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

module.exports = config;
