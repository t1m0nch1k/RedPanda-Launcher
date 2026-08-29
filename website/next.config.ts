import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // Keep the website self-contained when the repository also has a root lockfile.
    root: process.cwd(),
  },
};

export default nextConfig;
