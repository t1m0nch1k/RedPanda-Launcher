import type { NextConfig } from "next";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const appVersion = readFileSync(resolve(process.cwd(), "..", "VERSION"), "utf8").trim();

const nextConfig: NextConfig = {
  turbopack: {
    // Keep the website self-contained when the repository also has a root lockfile.
    root: process.cwd(),
  },
  env: {
    NEXT_PUBLIC_APP_VERSION: appVersion,
  },
};

export default nextConfig;
