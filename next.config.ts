import type { NextConfig } from "next";
import { assertLegalReady } from "./src/legal/guard";

// Falla el build si se activan las valoraciones sin los datos del titular (aviso legal).
assertLegalReady();

const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
