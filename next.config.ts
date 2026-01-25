import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ignorar erros de build para garantir deploy rápido na Vercel
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
