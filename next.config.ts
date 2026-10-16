import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,

  output: "standalone",

  allowedDevOrigins: process.env.TUNNEL_TENANT_ID
    ? ["*.trycloudflare.com"]
    : [],
};

const withNextIntl = createNextIntlPlugin();

export default withNextIntl(nextConfig);
