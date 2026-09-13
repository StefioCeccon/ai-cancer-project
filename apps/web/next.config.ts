import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
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
