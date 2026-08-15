import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The floating dev badge sits over the hero's bottom-left corner, which
  // makes visual comparison against the reference harder than it needs to be.
  devIndicators: false,
};

export default nextConfig;
