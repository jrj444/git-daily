/** @type {import('next').NextConfig} */
const nextConfig = {
  ...(process.env.BUILD_STANDALONE === "true" || process.platform !== "win32"
    ? { output: "standalone" }
    : {}),
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ["@prisma/client", "bcryptjs"],
  },
};

export default nextConfig;
