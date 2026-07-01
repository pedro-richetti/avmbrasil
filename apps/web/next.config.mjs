/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@avm/domain", "@avm/valuation-core", "@avm/db"]
};

export default nextConfig;
