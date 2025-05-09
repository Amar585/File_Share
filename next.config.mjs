/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Completely disable development tools indicators for a cleaner UI
  devIndicators: {
    // Use the new property name (position instead of buildActivityPosition)
    position: 'bottom-right',
    // Set this to false to completely hide the indicator
    enabled: false,
  },
}

export default nextConfig
