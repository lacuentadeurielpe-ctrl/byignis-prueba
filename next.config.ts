import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['mindee', 'pdf-parse', 'pdfjs-dist'],
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
