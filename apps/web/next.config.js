/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  images: {
    domains: ['localhost'],
  },
  async rewrites() {
    // In Docker: API is at http://api:4000
    // On host: browser connects directly to http://localhost:4000 via apiClient
    const apiTarget = process.env.API_BASE_URL || 'http://api:4000';
    return [
      {
        source: '/api/:path*',
        destination: `${apiTarget}/api/:path*`,
      },
      {
        source: '/health',
        destination: `${apiTarget}/health`,
      }
    ];
  }
};

module.exports = nextConfig;