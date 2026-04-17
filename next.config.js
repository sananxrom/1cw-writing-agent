/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['pixabay.com', 'cdn.pixabay.com', 'i.ytimg.com'],
  },
}

module.exports = nextConfig
