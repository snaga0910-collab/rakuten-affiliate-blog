import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAllArticles, getArticle, getSlugs } from "@/lib/articles";

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
  return { title: found.title, description: found.description };
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!getSlugs().includes(slug)) notFound();
  const { meta, html } = await getArticle(slug);

  return (
    <article className="article">
      <nav className="breadcrumb">
        <Link href="/">← 一覧に戻る</Link>
      </nav>
      <header className="article-head">
        {meta.category && <span className="article-cat">{meta.category}</span>}
        <h1>{meta.title}</h1>
        <p className="article-date">
          {meta.date}
          {meta.updated && meta.updated !== meta.date
            ? `（更新: ${meta.updated}）`
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
