import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
