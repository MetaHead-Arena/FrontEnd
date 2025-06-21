/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    config.externals = config.externals || [];
    config.externals.push({
      'phaser': 'Phaser'
    });
    return config;
  },
}

module.exports = nextConfig 