/** @type {import('next').NextConfig} */

// 2026-09-03: 旧ドメイン（rakuten-affiliate-blog.vercel.app）が生きたままで、
// 同じ記事が2つのURLで200を返していた。Search Console でも旧17ページ・
// 新18ページが別々に登録されていて、評価が2つに割れる。
//
// canonical は前から新ドメインを指していたが、canonical は「ヒント」でしかない。
// 301 なら移転として扱われ、旧ドメインが集めた評価がそのまま引き継がれる。
//
// Vercel は同じプロジェクトに両方のドメインが向いているので、
// ホスト名を見て振り分ける。パスとクエリはそのまま持っていく。
const OLD_HOST = "rakuten-affiliate-blog.vercel.app";
const NEW_ORIGIN = "https://hitorikurashi-note.vercel.app";

const nextConfig = {
  // 記事は全て静的生成（SEO向け・Vercelで高速配信）
  reactStrictMode: true,
  images: {
    remotePatterns: [{ protocol: "https", hostname: "thumbnail.image.rakuten.co.jp" }],
  },
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: OLD_HOST }],
        destination: `${NEW_ORIGIN}/:path*`,
        permanent: true, // 308（301と同じく恒久的な移転として扱われる）
      },
    ];
  },
};

export default nextConfig;
