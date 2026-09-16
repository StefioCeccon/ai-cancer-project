import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import path from "path";
import { fileURLToPath } from "url";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // Lean image for Docker / self-host (copies only traced production files).
  output: "standalone",
  // Monorepo: include workspace packages in the standalone file trace.
  outputFileTracingRoot: path.join(__dirname, "../.."),
  serverExternalPackages: ["pdf-parse", "formidable"],
  experimental: {
    serverActions: { bodySizeLimit: "150mb" },
  },
  // Fall through to the R2 signed-URL redirect ONLY when no static file matched.
  // Locally, public/uploads/* is served statically and this rewrite never triggers,
  // so local data and scans keep working unchanged. On the R2-backed deploy (empty
  // public/uploads), /uploads/* resolves via /api/files/* → 302 to a signed R2 URL.
  async rewrites() {
    return {
      beforeFiles: [],
      afterFiles: [{ source: "/uploads/:path*", destination: "/api/files/:path*" }],
      fallback: [],
    };
  },
  webpack: (config) => {
    // cornerstone3D needs these for browser
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
    };
    return config;
  },
};

export default withNextIntl(nextConfig);
