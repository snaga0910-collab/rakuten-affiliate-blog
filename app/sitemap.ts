import type { MetadataRoute } from "next";
import { getAllArticles } from "@/lib/articles";
import { SITE } from "@/lib/site";

// 検索エンジンに記事の場所を知らせるサイトマップ（/sitemap.xml で配信される）
export default function sitemap(): MetadataRoute.Sitemap {
  const base = SITE.url.replace(/\/$/, "");
  const articles = getAllArticles();
  // lastmod は日付のみ（YYYY-MM-DD）にする。ミリ秒付きの値を嫌う
  // クローラー実装があるため、互換性の高い形式に揃えておく。
  const day = (d: string | Date) =>
    new Date(d).toISOString().slice(0, 10);
  return [
    {
      // Search Console のプロパティ（末尾スラッシュ付き）と表記を合わせる
      url: `${base}/`,
      lastModified: day(new Date()),
      changeFrequency: "weekly",
      priority: 1,
    },
    ...articles.map((a) => ({
      url: `${base}/articles/${a.slug}`,
      lastModified: day(a.updated || a.date),
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
  ];
}
