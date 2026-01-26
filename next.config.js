/** @type {import('next').NextConfig} */
const nextConfig = {
    typescript: {
        ignoreBuildErrors: true,
    },
    // 'export' cria HTMLs estáticos na pasta 'out'
    output: 'export',
    // Imagens não otimizadas são necessárias para Static Export
    images: {
        unoptimized: true
    }
};

module.exports = nextConfig;
