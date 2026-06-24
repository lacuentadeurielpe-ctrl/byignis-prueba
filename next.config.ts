import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['mindee', 'pdf-parse', 'pdfjs-dist', 'unpdf'],
  async redirects() {
    return [
      // www → apex redirect (prevents ERR_TOO_MANY_REDIRECTS when both domains are in Vercel)
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'www.uintegrus.com' }],
        destination: 'https://uintegrus.com/:path*',
        permanent: true,
      },
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
