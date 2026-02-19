/** @type {import('next').NextConfig} */
const isBuild = process.env.TAURI_BUILD === 'true';

const nextConfig = {
    typescript: {
        ignoreBuildErrors: true,
    },

    // Gera output estático apenas para build do Tauri
    output: isBuild ? 'export' : undefined,
    images: {
        unoptimized: true
    },
    // Proxy para API do Rust em Dev (evita CORS e permite acessar /api/status)
    rewrites: async () => {
        if (isBuild) return [];
        return [
            {
                source: '/api/:path*',
                destination: 'http://127.0.0.1:3001/api/:path*'
            }
        ];
    }
};

module.exports = nextConfig;
