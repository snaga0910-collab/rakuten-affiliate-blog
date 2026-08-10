import Link from "next/link";
import { articlesByTheme } from "@/lib/related";
import { SITE } from "@/lib/site";

export default function HomePage() {
  // 商品カテゴリではなく「使う場所」で並べる。
  // 洗面所から来た人に、洗濯やキッチンの記事も同じ棚にあると気づいてもらうため。
  const groups = articlesByTheme();
  const total = groups.reduce((n, g) => n + g.items.length, 0);

  return (
    <>
      <section className="intro">
        <h1>{SITE.name}</h1>
        <p>{SITE.description}</p>
      </section>

      {total === 0 && <p className="empty">記事はまだありません。</p>}

      <nav className="theme-nav" aria-label="使う場所から探す">
        {groups.map(({ theme, items }) => (
          <a key={theme?.id ?? "other"} href={`#${theme?.id ?? "other"}`}>
            {theme?.name ?? "そのほか"}
            <span className="num">{items.length}</span>
          </a>
        ))}
      </nav>

      {groups.map(({ theme, items }) => (
        <section
          key={theme?.id ?? "other"}
          id={theme?.id ?? "other"}
          className="theme-block"
          aria-label={theme?.name ?? "そのほかの記事"}
        >
          <h2 className="theme-head">
            {theme?.name ?? "そのほか"}
            {theme?.note && <span className="theme-note">{theme.note}</span>}
          </h2>
          <div className="article-list">
            {items.map((a) => (
              <Link key={a.slug} href={`/articles/${a.slug}`} className="card">
                {a.category && <span className="card-cat">{a.category}</span>}
                <h3 className="card-title">{a.title}</h3>
                {a.description && <p className="card-desc">{a.description}</p>}
                <span className="card-date">{a.date}</span>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}
