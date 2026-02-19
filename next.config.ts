import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "rfwhtalljicdfwafcrto.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      {
        protocol: "https",
        hostname: "chjswljpjxjcsbiresnb.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },

  // Generate unique build ID for cache busting on each deployment
  generateBuildId: async () => {
    // Use timestamp + random string for guaranteed uniqueness
    return `${Date.now()}-${Math.random().toString(36).substring(7)}`;
  },

  // Custom headers for optimal caching strategy
  async headers() {
    return [
      {
        // Cache static assets aggressively (JS, CSS, fonts, images)
        source: "/:all*(svg|jpg|jpeg|png|gif|ico|webp|woff|woff2|ttf|otf)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        // Cache Next.js static files with versioning
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        // Don't cache HTML pages - always revalidate
        source: "/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=0, must-revalidate",
          },
        ],
      },
      {
        // Don't cache API routes
        source: "/api/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, no-cache, must-revalidate, proxy-revalidate",
          },
          {
            key: "Pragma",
            value: "no-cache",
          },
          {
            key: "Expires",
            value: "0",
          },
        ],
      },
    ];
  },

  // Disable x-powered-by header for security
  poweredByHeader: false,

  // Enable compression
  compress: true,

  // Optimize production builds
  productionBrowserSourceMaps: false,

  // SWC minification (faster than Terser)
  swcMinify: true,
};

export default nextConfig;
