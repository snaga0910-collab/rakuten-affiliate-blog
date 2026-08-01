import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { marked } from "marked";

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

export async function getArticle(
  slug: string
): Promise<{ meta: ArticleMeta; html: string }> {
  const { data, content } = matter(readRaw(slug));
  let html = await marked.parse(content);
  // アフィリンク等の外部リンクは別タブ＋rel="sponsored"（SEO/規約対応）
  html = html.replace(
    /<a href="(https?:\/\/[^"]+)"/g,
    '<a href="$1" target="_blank" rel="sponsored nofollow noopener"'
  );
  return { meta: toMeta(slug, data), html };
}
