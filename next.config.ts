import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // Keep Turbopack rooted on this app (avoids picking up a parent package-lock).
  turbopack: {
    root: projectRoot,
  },
};

export default nextConfig;
