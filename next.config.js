/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Allow importing fs and path modules in Next.js
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Don't attempt to load these modules on the client side
      config.resolve.fallback = {
        fs: false,
        path: false,
        crypto: false,
      };
    }
    return config;
  },
  // Disable static optimization for the editor page
  // This ensures the page is always server-side rendered
  unstable_runtimeJS: true,
  pageExtensions: ["tsx", "ts", "jsx", "js"],
};

module.exports = nextConfig;
