/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  images: {
    domains: ['localhost'],
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://api:4000/api/:path*',
      },
      {
        source: '/health',
        destination: 'http://api:4000/health',
      }
    ];
  }
};

module.exports = nextConfig;