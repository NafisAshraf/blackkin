import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",

  // Cache public pages at Cloudflare edge so bots and repeat visitors
  // are served from cache instead of triggering fresh SSR + Convex calls.
  async headers() {
    return [
      {
        // Home page — cache for 60s, serve stale for up to 5 min while revalidating
        source: "/",
        headers: [
          {
            key: "Cache-Control",
            value: "public, s-maxage=60, stale-while-revalidate=300",
          },
        ],
      },
      {
        // Product listing + individual product pages
        source: "/products/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, s-maxage=30, stale-while-revalidate=120",
          },
        ],
      },
      {
        // Blog pages
        source: "/blog/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, s-maxage=300, stale-while-revalidate=600",
          },
        ],
      },
    ];
  },
};

export default nextConfig;

import("@opennextjs/cloudflare").then((m) => m.initOpenNextCloudflareForDev());
