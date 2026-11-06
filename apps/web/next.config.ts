import type { NextConfig } from "next";
import path from "node:path";

const publicApiUrl = process.env.NEXT_PUBLIC_API_URL?.trim();
const apiUrl = (process.env.API_URL?.trim() || (publicApiUrl?.startsWith("http") ? publicApiUrl : undefined) || "http://127.0.0.1:4000/api/v1").replace(/\/+$/, "");

const nextConfig: NextConfig = {
  // Allow verification builds without overwriting a running dev server's files.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  transpilePackages: ["@edu/api-client", "@edu/shared"],
  async rewrites() {
    return [{ source: "/api/v1/:path*", destination: `${apiUrl}/:path*` }];
  },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "res.cloudinary.com" }],
  },
  /* config options here */
  experimental: {
    agentFeedback: true,
    agentUpgrade: "security",
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    root: path.resolve(__dirname, "../../"),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
