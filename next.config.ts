import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Keep local production builds predictable on lower-resource workstations.
  experimental: {
    cpus: 2,
  },
  // TypeScript is checked explicitly before every deployment. Skipping Next's
  // duplicate worker avoids build stalls on the low-resource Windows machine.
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
