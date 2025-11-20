import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  eslint: {
    // Allow production builds to succeed even if there are ESLint errors.
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.supabase.co",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
    ],
  },
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
