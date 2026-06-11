import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['mindee'],
  async redirects() {
    return [
      {
        source: '/dashboard/settings',
        destination: '/dashboard/settings-2',
        permanent: true,
      },
      {
        source: '/dashboard/settings/:path*',
        destination: '/dashboard/settings-2/:path*',
        permanent: true,
      },
    ]
  },
};

export default nextConfig;
