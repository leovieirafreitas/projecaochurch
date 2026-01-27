/** @type {import('next').NextConfig} */
const nextConfig = {
    typescript: {
        ignoreBuildErrors: true,
    },
    // Gera output estático apenas para build do Tauri
    output: process.env.TAURI_BUILD === 'true' ? 'export' : undefined,
    images: {
        unoptimized: true
    }
};

module.exports = nextConfig;
