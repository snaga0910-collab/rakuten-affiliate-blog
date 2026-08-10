import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { renderArticle } from "./render";

const CONTENT_DIR = path.join(process.cwd(), "content");

export type ArticleMeta = {
  slug: string;
  title: string;
  description: string;
  category: string;
  date: string;
  updated?: string;
};

function readRaw(slug: string): string {
  return fs.readFileSync(path.join(CONTENT_DIR, `${slug}.md`), "utf8");
}

/** frontmatter を除いた本文。関連記事の判定（lib/related.ts）から使う。 */
export function readContent(slug: string): string {
  return matter(readRaw(slug)).content;
}

function toMeta(slug: string, data: Record<string, unknown>): ArticleMeta {
  return {
    slug,
    title: String(data.title ?? slug),
    description: String(data.description ?? ""),
    category: String(data.category ?? ""),
    date: String(data.date ?? ""),
    updated: data.updated ? String(data.updated) : undefined,
  };
}

export function getSlugs(): string[] {
  if (!fs.existsSync(CONTENT_DIR)) return [];
  return fs
    .readdirSync(CONTENT_DIR)
    .filter((f) => f.endsWith(".md"))
    .map((f) => f.replace(/\.md$/, ""));
}

export function getAllArticles(): ArticleMeta[] {
  return getSlugs()
    .map((slug) => toMeta(slug, matter(readRaw(slug)).data))
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

export type Faq = { question: string; answer: string };

/** 本文の「よくある質問」セクションから Q/A を抜き出す（FAQPage 構造化データ用）。 */
export function extractFaqs(markdown: string): Faq[] {
  // 「## よくある質問」から次の H2 までを対象にする
  const section = markdown.match(
    /^##\s+よくある質問[^\n]*\n([\s\S]*?)(?=^##\s|\Z)/m
  );
  if (!section) return [];
  const faqs: Faq[] = [];
  // **Q. 質問** \n A. 回答  の形式を拾う
  const re = /\*\*Q\.\s*(.+?)\*\*\s*\n\s*A\.\s*([^\n]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(section[1])) !== null) {
    faqs.push({ question: m[1].trim(), answer: m[2].trim() });
  }
  return faqs;
}

/** 記事のコスト比較グラフ（あれば）をインラインSVGで返す。 */
function costChart(slug: string): string | undefined {
  const f = path.join(process.cwd(), "public", "charts", `${slug}-cost.svg`);
  return fs.existsSync(f) ? fs.readFileSync(f, "utf8") : undefined;
}

export async function getArticle(
  slug: string,
  /** 比較表・グラフの直後に差し込む、次の記事への導線（lib/related.ts が組み立てる） */
  nextStepHtml?: string
): Promise<{ meta: ArticleMeta; html: string; faqs: Faq[] }> {
  const { data, content } = matter(readRaw(slug));
  const faqs = extractFaqs(content);
  // 比較表・付箋・手順・Q&A をデザイン案A のパーツに変換する
  const html = renderArticle(content, slug, costChart(slug), nextStepHtml);
  return { meta: toMeta(slug, data), html, faqs };
}
