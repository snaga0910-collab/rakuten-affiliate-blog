import type { MetadataRoute } from "next";
import { getAllArticles } from "@/lib/articles";
import { SITE } from "@/lib/site";

// 検索エンジンに記事の場所を知らせるサイトマップ（/sitemap.xml で配信される）
export default function sitemap(): MetadataRoute.Sitemap {
  const base = SITE.url.replace(/\/$/, "");
  const articles = getAllArticles();
  return [
    {
      url: base,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
    ...articles.map((a) => ({
      url: `${base}/articles/${a.slug}`,
      lastModified: new Date(a.updated || a.date),
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
  ];
}
