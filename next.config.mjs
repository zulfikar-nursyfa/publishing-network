/** @type {import("next").NextConfig} */
const nextConfig = {
  outputFileTracingIncludes: {
    "/api/connector/info": ["./wordpress/plugins/publishing-network/publishing-network.php"],
    "/api/connector/download": ["./wordpress/plugins/publishing-network/publishing-network.php"],
  },
  experimental: {
    serverActions: { bodySizeLimit: "4mb" },
  },
};

export default nextConfig;
