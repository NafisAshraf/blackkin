import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Keep local production builds predictable on lower-resource workstations.
  experimental: {
    cpus: 2,
  },
};

export default nextConfig;
