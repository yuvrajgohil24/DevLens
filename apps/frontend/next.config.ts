import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ['@base-ui/react'],
  experimental: {
    turbo: {
      root: '../../',
    },
  },
};

export default nextConfig;
