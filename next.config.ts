import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    serverActions: {
      // NASR subscription ZIPs can be large (~200-400MB depending on cycle)
      bodySizeLimit: '600mb',
    },
  },
};

export default nextConfig;
