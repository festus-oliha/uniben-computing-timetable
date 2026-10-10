import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite (the built-in local database) ships WebAssembly files and must not be bundled.
  serverExternalPackages: ["@electric-sql/pglite"],
};

export default nextConfig;
