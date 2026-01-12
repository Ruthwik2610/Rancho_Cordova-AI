/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // This ensures that API routes (like your chat handler) build correctly
  serverExternalPackages: ['@pinecone-database/pinecone'],
  // Sometimes required for Recharts to work smoothly during minification
  swcMinify: true, 
};

export default nextConfig;