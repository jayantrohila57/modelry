import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Permissions-Policy",
            value: [
              'accelerometer=(self "https://checkout.razorpay.com" "https://api.razorpay.com" "https://razorpay.com")',
              'gyroscope=(self "https://checkout.razorpay.com" "https://api.razorpay.com" "https://razorpay.com")',
            ].join(", "),
          },
        ],
      },
    ];
  },
  experimental: {
    authInterrupts: true,
    typedEnv: true,
  },
  typescript: {
    tsconfigPath: "tsconfig.json",
  },
  typedRoutes: true,
  reactCompiler: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "example.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "*.public.blob.vercel-storage.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
      },
      {
        protocol: "https",
        hostname: "api.dicebear.com",
      },
    ],
  },
};

export default nextConfig;
