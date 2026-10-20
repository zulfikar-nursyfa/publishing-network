/** @type {import("next").NextConfig} */
const nextConfig = {
  outputFileTracingIncludes: {
    "/docs/downloads/publishing-network": ["./wordpress/mu-plugins/publishing-network.php"],
  },
  experimental: {
    serverActions: { bodySizeLimit: "4mb" },
  },
};

export default nextConfig;
