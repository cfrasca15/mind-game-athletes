import type { NextConfig } from "next";

// Server Actions reject POSTs whose Origin isn't listed here (CSRF guard).
// Every host:port the app is reached through must be in ALLOWED_ORIGINS.
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "localhost:3000")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": { loaders: ["@tailwindcss/turbopack"], as: "*.css" },
    },
  },
  experimental: {
    serverActions: { allowedOrigins },
  },
};

export default nextConfig;
