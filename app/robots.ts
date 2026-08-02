import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

// クローラー向けの指示（/robots.txt で配信される）
export default function robots(): MetadataRoute.Robots {
  const base = SITE.url.replace(/\/$/, "");
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${base}/sitemap.xml`,
  };
}
