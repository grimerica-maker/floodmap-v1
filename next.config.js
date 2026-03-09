/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: "/engine/:path*",
        destination: "http://137.184.86.1:8000/:path*",
      },
    ];
  },
};

module.exports = nextConfig;
