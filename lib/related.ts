// 記事どうしのつながり（回遊）を決める。
//
// 検索で1本目にたどり着いた人に「洗剤の記事もあるじゃん」と気づいてもらうのが目的。
// つながりは「使う場所」で作る。読者は商品カテゴリではなく場面で思い出すため。
//
// 出す情報は記事本文の実データ（比較表のコスト幅）に限る。
// 「読んだ人はこちらも」のような根拠のない文言は置かない。
import {
  getAllArticles,
  readContent,
  readFrontmatter,
  type ArticleMeta,
} from "./articles";

export type Theme = {
  id: string;
  name: string;
  /** テーマの説明。一覧ページの小見出しに出す */
  note: string;
  slugs: string[];
};

/** 使う場所でまとめたテーマ。新しい記事を足したらここにも slug を入れる。 */
export const THEMES: Theme[] = [
  {
    id: "washroom",
    name: "洗面所",
    note: "毎日の歯みがきまわり",
    slugs: ["oral-care", "toothbrush-head", "toothpaste", "shampoo"],
  },
  {
    id: "laundry",
    name: "洗濯",
    note: "部屋干しのにおい対策",
    slugs: [
      "laundry-odor",
      "fabric-softener",
      "laundry-detergent",
      "washer-cleaner",
      "clothes-deodorant",
    ],
  },
  {
    id: "kitchen",
    name: "キッチン",
    note: "水まわりと洗いもの",
    slugs: [
      "dishwasher-detergent",
      "dish-soap",
      "water-filter",
      "water-server",
      "coffee-drip",
    ],
  },
  {
    id: "bath",
    name: "お風呂",
    note: "上がったあとの足もと",
    slugs: ["diatomite-bathmat"],
  },
  // 2026-08-18 新設。消耗品ではないが「毎月かかるお金を実データで比べる」という
  // このサイトの軸は同じ。単価がA8案件なので期待値も高い。
  {
    id: "fixed-cost",
    name: "毎月の固定費",
    note: "契約で決まる出費",
    slugs: ["hikari-internet", "water-purifier-server", "meal-delivery"],
  },
  // 2026-08-17 新設。ここから比較の軸を「1回あたりコスト」ではなく
  // 「好み・タイプで選び分ける」に変えた記事を置く。
  {
    id: "grooming",
    name: "身だしなみ",
    note: "出かける前に足すもの",
    slugs: ["perfume"],
  },
];

/**
 * テーマをまたぐつながり。理由があるものだけ書く。
 *   コーヒー ⇄ 浄水器   … 味を決めるのは水
 *   バスマット → 洗濯洗剤 … 布タイプを選ぶと洗濯の回数が増える
 *   香水 ⇄ 柔軟剤      … 好きな香りの系統は両方でだいたい一致する
 */
const AFFINITY: Record<string, string[]> = {
  "dish-soap": ["dishwasher-detergent", "water-filter"],
  "coffee-drip": ["water-filter"],
  "water-filter": ["water-purifier-server", "water-server", "coffee-drip"],
  "water-server": ["water-purifier-server", "water-filter"],
  "water-purifier-server": ["water-filter", "water-server"],
  "hikari-internet": ["water-purifier-server", "meal-delivery"],
  "meal-delivery": ["hikari-internet", "coffee-drip"],
  "diatomite-bathmat": ["laundry-detergent", "fabric-softener"],
  "laundry-detergent": ["laundry-odor", "diatomite-bathmat"],
  "laundry-odor": ["laundry-detergent", "fabric-softener", "washer-cleaner"],
  // 香りが重なるので、香水と柔軟剤は消臭スプレーとも並べて見せたい
  "clothes-deodorant": ["fabric-softener", "perfume", "diatomite-bathmat"],
  "fabric-softener": ["diatomite-bathmat", "perfume"],
  perfume: ["fabric-softener", "shampoo"],
};

export function themeOf(slug: string): Theme | undefined {
  return THEMES.find((t) => t.slugs.includes(slug));
}

/* ── 比較表からコスト幅を取り出す ───────────────────────── */

export type CostRange = { label: string; min: string; max: string } | null;

function tableBlocks(md: string): string[][] {
  const blocks: string[][] = [];
  let cur: string[] = [];
  for (const line of md.split("\n")) {
    if (line.trim().startsWith("|")) cur.push(line);
    else if (cur.length) {
      blocks.push(cur);
      cur = [];
    }
  }
  if (cur.length) blocks.push(cur);
  return blocks;
}

function cells(line: string): string[] {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
}

/** 指定した列から「約1,234円」「1,234円」の数値を集める。 */
function amounts(rows: string[][], idx: number): number[] {
  const out: number[] = [];
  for (const r of rows) {
    const m = (r[idx] ?? "").match(/約?([\d,]+(?:\.\d+)?)\s*円/);
    if (m) out.push(Number(m[1].replace(/,/g, "")));
  }
  return out;
}

/**
 * 記事の比較表から「1回あたり◯円〜◯円」を取り出す。
 * コスト列がない記事（バスマットなど）は価格の幅を返す。
 * 表が複数ある記事は、値がいちばん多く取れた表を採用する。
 */
export function costRange(slug: string): CostRange {
  // frontmatter に costLabel / costMin / costMax があればそれを使う。
  // 「1回あたりコスト」が主役ではない記事（香水など）のための逃げ道。
  // 香水は比較表に「1mLあたり」の列があるので自動抽出だとそれを拾ってしまうが、
  // 本文では「その数字で選ぶと失敗する」と書いているので、カードには出せない。
  const front = readFrontmatter(slug);
  if (front.costLabel && front.costMin && front.costMax) {
    return {
      label: String(front.costLabel),
      min: String(front.costMin),
      max: String(front.costMax),
    };
  }

  let raw: string;
  try {
    raw = readContent(slug);
  } catch {
    return null;
  }
  let best: { label: string; values: number[] } | null = null;

  for (const block of tableBlocks(raw)) {
    const rows = block.map(cells);
    if (rows.length < 2) continue;
    const header = rows[0];
    const body = rows.slice(rows[1].every((c) => /^:?-{2,}:?$/.test(c)) ? 2 : 1);

    // 「1回あたり目安」などのコスト列を優先し、無ければ価格列を見る
    let idx = header.findIndex((h) => /あたり/.test(h));
    if (idx < 0) idx = header.findIndex((h) => /^価格/.test(h));
    if (idx < 0) continue;

    const values = amounts(body, idx);
    if (values.length < 2) continue;
    const label = header[idx].replace(/目安$/, "").trim() || "価格";
    if (!best || values.length > best.values.length) best = { label, values };
  }

  if (!best) return null;
  const yen = (n: number) => `${n.toLocaleString()}円`;
  return {
    label: best.label,
    min: yen(Math.min(...best.values)),
    max: yen(Math.max(...best.values)),
  };
}

/* ── 関連記事の並び ─────────────────────────────────── */

export type RelatedCard = ArticleMeta & { cost: CostRange; theme?: Theme };

function card(meta: ArticleMeta): RelatedCard {
  return { ...meta, cost: costRange(meta.slug), theme: themeOf(meta.slug) };
}

/** 本文中ですでに紹介している記事の slug。二重に出さないために使う。 */
function linkedInBody(slug: string): Set<string> {
  let raw = "";
  try {
    raw = readContent(slug);
  } catch {
    return new Set();
  }
  const found = new Set<string>();
  for (const m of raw.matchAll(/\/articles\/([a-z0-9-]+)/g)) found.add(m[1]);
  return found;
}

/** 同じテーマの他の記事。 */
export function sameThemeArticles(slug: string): RelatedCard[] {
  const theme = themeOf(slug);
  if (!theme) return [];
  const all = getAllArticles();
  return theme.slugs
    .filter((s) => s !== slug)
    .map((s) => all.find((a) => a.slug === s))
    .filter((a): a is ArticleMeta => Boolean(a))
    .map(card);
}

/** 別テーマの記事。理由のあるつながりを先に、あとは新しい順。 */
export function otherThemeArticles(slug: string, limit = 3): RelatedCard[] {
  const theme = themeOf(slug);
  const exclude = new Set([slug, ...(theme?.slugs ?? [])]);
  const all = getAllArticles();
  const picked: ArticleMeta[] = [];

  for (const s of AFFINITY[slug] ?? []) {
    if (exclude.has(s)) continue;
    const a = all.find((x) => x.slug === s);
    if (a) {
      picked.push(a);
      exclude.add(s);
    }
  }
  for (const a of all) {
    if (picked.length >= limit) break;
    if (exclude.has(a.slug)) continue;
    picked.push(a);
    exclude.add(a.slug);
  }
  return picked.slice(0, limit).map(card);
}

/**
 * 本文の途中に1本だけ差し込む記事。
 * 最後まで読む人は多くないので、比較表を見た直後に次の入口を置く。
 * 本文ですでにリンクしている記事は選ばない（同じ導線が重なるため）。
 */
export function nextStepArticle(slug: string): RelatedCard | null {
  const used = linkedInBody(slug);
  const theme = themeOf(slug);
  const all = getAllArticles();
  const order = [
    ...(theme?.slugs ?? []),
    ...(AFFINITY[slug] ?? []),
    ...all.map((a) => a.slug),
  ];
  for (const s of order) {
    if (s === slug || used.has(s)) continue;
    const a = all.find((x) => x.slug === s);
    if (a) return card(a);
  }
  return null;
}

/** 一覧ページ用に、テーマごとへ記事を振り分ける（テーマ未設定の記事は最後にまとめる）。 */
export function articlesByTheme(): { theme: Theme | null; items: ArticleMeta[] }[] {
  const all = getAllArticles();
  const used = new Set<string>();
  const groups: { theme: Theme | null; items: ArticleMeta[] }[] = THEMES.map((theme) => {
    const items = theme.slugs
      .map((s) => all.find((a) => a.slug === s))
      .filter((a): a is ArticleMeta => Boolean(a));
    items.forEach((a) => used.add(a.slug));
    return { theme, items };
  }).filter((g) => g.items.length > 0);

  const rest = all.filter((a) => !used.has(a.slug));
  if (rest.length) groups.push({ theme: null, items: rest });
  return groups;
}
