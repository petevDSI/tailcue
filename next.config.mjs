/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.resolve.alias['@react-pdf/renderer'] = false
    }
    config.resolve.alias.canvas = false
    return config
  },
}

export default nextConfig
