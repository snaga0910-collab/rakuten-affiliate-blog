import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAllArticles, getArticle, getSlugs } from "@/lib/articles";
import {
  nextStepArticle,
  otherThemeArticles,
  sameThemeArticles,
  themeOf,
  type RelatedCard,
} from "@/lib/related";
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
  // 記事ごとのサムネイル（npm run thumb で public/thumbnails に生成）。
  // これが無いと note・Pinterest・LINE などでURLを貼ったとき画像なしのカードになる。
  const image = { url: `/thumbnails/${slug}.png`, width: 1280, height: 670, alt: found.title };
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
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title: found.title,
      description: found.description,
      images: [image.url],
    },
  };
}

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** 本文の途中に差し込む、次の記事への導線（メモ書き風の1行）。 */
function nextStepMarkup(card: RelatedCard | null): string | undefined {
  if (!card) return undefined;
  const cost = card.cost
    ? `<span class="pa-next-cost num">${esc(card.cost.label)} ${esc(card.cost.min)}〜${esc(card.cost.max)}</span>`
    : "";
  return `<aside class="pa-next">
<span class="pa-next-label">ついでに見直すなら</span>
<a href="/articles/${esc(card.slug)}">${esc(card.title)}</a>
${cost}
</aside>`;
}

/** 記事末尾の関連記事カード。 */
function RelatedList({ items }: { items: RelatedCard[] }) {
  return (
    <ul className="rel-list">
      {items.map((a) => (
        <li key={a.slug}>
          <Link href={`/articles/${a.slug}`} className="rel-card">
            {a.category && <span className="rel-cat">{a.category}</span>}
            <span className="rel-title">{a.title}</span>
            {a.cost && (
              <span className="rel-cost num">
                {a.cost.label} {a.cost.min}〜{a.cost.max}
              </span>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!getSlugs().includes(slug)) notFound();
  const theme = themeOf(slug);
  const sameTheme = sameThemeArticles(slug);
  // 同じテーマが少ない記事ほど、別テーマから多めに出す
  const others = otherThemeArticles(slug, sameTheme.length > 0 ? 3 : 4);
  const { meta, html, faqs } = await getArticle(
    slug,
    nextStepMarkup(nextStepArticle(slug))
  );

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
        <Link href="/">記事一覧</Link>
        {theme && (
          <>
            <span aria-hidden="true">／</span>
            <Link href={`/#${theme.id}`}>{theme.name}で使うもの</Link>
          </>
        )}
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

      <nav className="related" aria-label="ほかの記事">
        {sameTheme.length > 0 && theme && (
          <section className="rel-block">
            <h2>
              同じ{theme.name}で使うもの
              <span className="rel-note">{theme.note}</span>
            </h2>
            <RelatedList items={sameTheme} />
          </section>
        )}
        {others.length > 0 && (
          <section className="rel-block">
            <h2>
              ほかの消耗品も実データで比べています
              {/* 「1回あたりのコストで並べています」と固定で書いていたが、
                  香水のようにコストが主役でない記事が出てきたので軸に依存しない表現にした */}
              <span className="rel-note">価格とレビューは楽天市場の実データです</span>
            </h2>
            <RelatedList items={others} />
          </section>
        )}
        <p className="rel-all">
          <Link href="/">記事をすべて見る →</Link>
        </p>
      </nav>
    </article>
  );
}
