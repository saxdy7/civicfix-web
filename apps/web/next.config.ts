import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@civicfix/ui-web", "@civicfix/contracts"],
};

export default nextConfig;
