/** @type {import('next').NextConfig} */
const nextConfig = {
  // Required for better-sqlite3 (native module)
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = [...(config.externals || []), "better-sqlite3"];
    }
    return config;
  },
};

module.exports = nextConfig;
