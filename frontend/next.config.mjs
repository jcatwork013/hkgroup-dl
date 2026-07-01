/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  output: "standalone", // image runtime nhỏ gọn, tự chứa server.js
  eslint: { ignoreDuringBuilds: true }, // không chặn build vì lint (vẫn type-check TS)
  // Cho phép ảnh từ CDN/back-end nếu cần (siết theo domain ở prod).
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8090",
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
    NEXT_PUBLIC_INVEST_API_URL: process.env.NEXT_PUBLIC_INVEST_API_URL ?? "http://localhost:8080",
  },
};

export default nextConfig;
