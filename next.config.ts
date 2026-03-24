import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: '/dashboard/kegiatan/:path*', destination: '/kegiatan/:path*', permanent: true },
      { source: '/dashboard/members/:path*',  destination: '/jemaat/:path*',   permanent: true },
      { source: '/dashboard/pelayan/:path*',  destination: '/pelayan/:path*',  permanent: true },
      { source: '/dashboard/pengurus/:path*', destination: '/pengurus/:path*', permanent: true },
      { source: '/dashboard/settings/:path*', destination: '/settings/:path*', permanent: true },
      { source: '/dashboard/family-tree',     destination: '/family-tree',     permanent: true },
      { source: '/dashboard',                 destination: '/',                permanent: true },
    ];
  },
};

export default nextConfig;
