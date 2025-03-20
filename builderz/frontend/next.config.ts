import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    BACKEND_URL: 'http://localhost:8000',
    NEXT_PUBLIC_MAPBOX_TOKEN: process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '',
  },
  images: {
    domains: ['localhost'],
  },
  async rewrites() {
    return [
      {
        source: '/api/graphs/:path*',
        destination: 'http://localhost:8000/graphs/:path*',
      },
      {
        source: '/geofiles/:path*',
        destination: 'http://localhost:8000/geofiles/:path*',
      },
    ];
  },
};

export default nextConfig;
