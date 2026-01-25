import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ignorar erros de TypeScript no build
  typescript: {
    ignoreBuildErrors: true,
  },
  // 'eslint' foi removido aqui pois nao é mais suportado no Next 16 (usar flag --no-lint)
};

export default nextConfig;
