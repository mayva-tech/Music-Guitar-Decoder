import type { NextConfig } from "next";

const backend = process.env.MUSIC_DECODER_API ?? "http://127.0.0.1:8000";

const nextConfig: NextConfig = {
  // The browser talks to /api/* on the same origin; Next proxies it to the FastAPI backend.
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${backend}/api/:path*` }];
  },
};

export default nextConfig;
