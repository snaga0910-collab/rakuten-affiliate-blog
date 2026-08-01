import Link from "next/link";
import { getAllArticles } from "@/lib/articles";
import { SITE } from "@/lib/site";

export default function HomePage() {
  const articles = getAllArticles();
  return (
    <>
      <section className="intro">
        <h1>{SITE.name}</h1>
        <p>{SITE.description}</p>
      </section>

      <section className="article-list" aria-label="記事一覧">
        {articles.length === 0 && (
          <p className="empty">記事はまだありません。</p>
        )}
        {articles.map((a) => (
          <Link key={a.slug} href={`/articles/${a.slug}`} className="card">
            {a.category && <span className="card-cat">{a.category}</span>}
            <h2 className="card-title">{a.title}</h2>
            {a.description && <p className="card-desc">{a.description}</p>}
            <span className="card-date">{a.date}</span>
          </Link>
        ))}
      </section>
    </>
  );
}
