import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "@tensorflow/tfjs-core",
    "@tensorflow/tfjs-converter",
    "@tensorflow/tfjs-backend-wasm",
    "@vladmandic/human",
  ],
  outputFileTracingIncludes: {
    '/api/kegiatan/[id]/export': ['./public/*.docx'],
    '/api/pegawai/presensi/**': [
      './public/models/**/*',
      './node_modules/@tensorflow/tfjs-backend-wasm/dist/*.wasm',
    ],
  },
  webpack: (config, { webpack }) => {
    config.plugins.push(
      new webpack.NormalModuleReplacementPlugin(/^node:/, (resource: { request: string }) => {
        resource.request = resource.request.replace(/^node:/, "");
      })
    );
    return config;
  },
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

export default withSerwist(nextConfig);
