import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Maior limite entre os uploads via Server Action: anexos do CRM (10MB).
      bodySizeLimit: "12mb",
    },
  },
  async redirects() {
    return [
      {
        source: "/clientes",
        destination: "/cadastros",
        permanent: false,
      },
      {
        source: "/clientes/:path*",
        destination: "/cadastros/:path*",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
