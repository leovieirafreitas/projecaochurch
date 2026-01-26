/** @type {import('next').NextConfig} */
const nextConfig = {
    typescript: {
        ignoreBuildErrors: true,
    },
    // REMOVIDO 'output: export' para permitir API Routes (/api/proxy)
    // Isso é necessário para a versão web funcionar com YouVersion API
    images: {
        unoptimized: true
    }
};

module.exports = nextConfig;
