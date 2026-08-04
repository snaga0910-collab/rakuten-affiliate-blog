/** @type {import('next').NextConfig} */
const nextConfig = {
  // 記事は全て静的生成（SEO向け・Vercelで高速配信）
  reactStrictMode: true,
  images: {
    remotePatterns: [{ protocol: "https", hostname: "thumbnail.image.rakuten.co.jp" }],
  },
};

export default nextConfig;
