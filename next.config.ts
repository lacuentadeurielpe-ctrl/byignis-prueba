import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['mindee', 'pdf-parse', 'pdfjs-dist', 'unpdf'],
  async redirects() {
    return [
      // www → apex (307 temporal para no cachear en el browser)
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'www.uintegrus.com' }],
        destination: 'https://uintegrus.com/:path*',
        permanent: false,
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
