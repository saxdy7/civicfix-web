import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@civicfix/ui-web", "@civicfix/contracts"],
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.convex.cloud",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
};

export default nextConfig;
