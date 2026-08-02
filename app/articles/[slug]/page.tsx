import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAllArticles, getArticle, getSlugs } from "@/lib/articles";
import { SITE } from "@/lib/site";

export function generateStaticParams() {
  return getSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const found = getAllArticles().find((a) => a.slug === slug);
  if (!found) return {};
  const path = `/articles/${slug}`;
  return {
    title: found.title,
    description: found.description,
    // note にも同じ記事を載せるため、正規URLはこのブログだと明示しておく
    alternates: { canonical: path },
    openGraph: {
      type: "article",
      url: path,
      title: found.title,
      description: found.description,
      publishedTime: found.date,
      modifiedTime: found.updated || found.date,
    },
    twitter: {
      card: "summary_large_image",
      title: found.title,
      description: found.description,
    },
  };
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!getSlugs().includes(slug)) notFound();
  const { meta, html, faqs } = await getArticle(slug);

  // FAQ の構造化データ（検索結果での表示は検索エンジン側の判断による）
  const faqJsonLd =
    faqs.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: faqs.map((f) => ({
            "@type": "Question",
            name: f.question,
            acceptedAnswer: { "@type": "Answer", text: f.answer },
          })),
        }
      : null;

  // 記事の構造化データ（公開日・更新日を検索エンジンに伝える）
  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: meta.title,
    description: meta.description,
    datePublished: meta.date,
    dateModified: meta.updated || meta.date,
    mainEntityOfPage: `${SITE.url.replace(/\/$/, "")}/articles/${slug}`,
    publisher: { "@type": "Organization", name: SITE.name },
  };

  return (
    <article className="article">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      {faqJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />
      )}
      <nav className="breadcrumb">
        <Link href="/">← 一覧に戻る</Link>
      </nav>
      <header className="article-head">
        {meta.category && <span className="article-cat">{meta.category}</span>}
        <h1>{meta.title}</h1>
        <p className="article-date">
          公開 {meta.date}
          {meta.updated && meta.updated !== meta.date
            ? ` ／ 最終更新 ${meta.updated}`
            : ""}
        </p>
      </header>
      <div
        className="article-body"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </article>
  );
}
