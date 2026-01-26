/** @type {import('next').NextConfig} */
const nextConfig = {
    typescript: {
        ignoreBuildErrors: true,
    },
    // 'eslint' removed as before
    // Ensure we can export nicely
    output: 'standalone',
};

module.exports = nextConfig;
