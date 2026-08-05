// 記事のMarkdownを、デザイン案A（ノート）のパーツに変換する。
//
// 記事はどれも同じ骨格で書かれているので、マークアップ側で意味づけできる:
//   - 比較表          → 商品画像つきの台帳テーブル
//   - 向いている人/向かない人 → 付箋2枚
//   - **Q. / A.       → Q&Aブロック
//   - > 引用           → メモ用紙
//   - 番号つきの手順    → 番号バッジつきのステップ
// 文字だけで進む記事に「息継ぎ」を作るのが目的。
import fs from "fs";
import path from "path";
import { marked } from "marked";

export type Product = {
  name: string; price: number; review: number; rating: number;
  url: string; image: string; shop: string;
};

let cache: Record<string, Product[]> | null = null;
export function products(slug: string): Product[] {
  if (!cache) {
    const f = path.join(process.cwd(), "data", "products.json");
    cache = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : {};
  }
  return cache![slug] ?? [];
}

/** 商品名から販促の飾りを落とす。 */
export function cleanName(n: string, len = 34): string {
  const s = n.replace(/【[^】]*】|＼[^／]*／|\[[^\]]*\]|［[^］]*］/g, "")
    .replace(/\s+/g, " ").trim();
  return s.length > len ? s.slice(0, len) + "…" : s;
}

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** インラインのMarkdown（太字・リンク）だけをHTMLにする。 */
function inline(md: string): string {
  return marked.parseInline(md) as string;
}

/** 商品名（またはリンクテキスト）から、対応する商品データを探す。 */
function matchProduct(label: string, list: Product[]): Product | null {
  const key = label.replace(/\s+/g, "");
  // ブランド名など、特徴的な語での部分一致を試す
  let best: Product | null = null;
  let bestLen = 0;
  for (const p of list) {
    const pn = p.name.replace(/\s+/g, "");
    for (let len = Math.min(key.length, 12); len >= 3; len--) {
      const frag = key.slice(0, len);
      if (pn.includes(frag) && len > bestLen) { best = p; bestLen = len; break; }
    }
  }
  return best;
}

/** 比較表のMarkdownを、商品画像つきの台帳テーブルにする。 */
function renderLedger(lines: string[], list: Product[]): string {
  const rows = lines.map((l) =>
    l.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim())
  );
  const header = rows[0];
  const body = rows.slice(rows[1]?.every((c) => /^:?-{2,}:?$/.test(c)) ? 2 : 1);

  // 「1回あたり」等のコスト列を見つけて、そこを強調する
  const costIdx = header.findIndex((h) => /あたり/.test(h));
  const costOf = (r: string[]) => {
    const m = (r[costIdx] ?? "").match(/約([\d,]+)/);
    return m ? Number(m[1].replace(/,/g, "")) : Number.MAX_SAFE_INTEGER;
  };
  const sorted = costIdx >= 0 ? [...body].sort((a, b) => costOf(a) - costOf(b)) : body;
  const min = costIdx >= 0 ? costOf(sorted[0]) : -1;

  const th = ["商品", ...header.slice(1)]
    .map((h, i) => `<th${i === 0 ? ' colspan="2"' : ""}>${esc(h)}</th>`).join("");

  const tr = sorted.map((r) => {
    const link = (r[0] || "").match(/\[([^\]]+)\]\(([^)]+)\)/);
    const label = link ? link[1] : r[0];
    const href = link ? link[2] : "";
    const p = matchProduct(label, list);
    const img = p?.image
      ? `<img class="thumb" src="${p.image}" alt="" loading="lazy" decoding="async">`
      : `<span class="thumb thumb-none" aria-hidden="true"></span>`;
    const meta = p
      ? `<div class="pshop num">★${p.rating.toFixed(1)}・${p.review.toLocaleString()}件／${esc(p.shop)}</div>`
      : "";
    // data-label は、狭い画面でテーブルをカード表示にするときの見出しに使う
    const cells = r.slice(1).map((c, i) => {
      const idx = i + 1;
      const label = ` data-label="${esc(header[idx] ?? "")}"`;
      if (idx === costIdx) {
        const isMin = costOf(r) === min;
        return `<td class="cost"${label}>${esc(c)}${isMin ? '<span class="best">最小</span>' : ""}</td>`;
      }
      return `<td class="${/^[\d,]+円$/.test(c) ? "num" : ""}"${label}>${inline(c)}</td>`;
    }).join("");
    return `<tr><td class="tcell">${img}</td><td class="tname"><div class="pname">${
      href ? `<a href="${href}" target="_blank" rel="sponsored nofollow noopener">${esc(label)}</a>` : esc(label)
    }</div>${meta}</td>${cells}</tr>`;
  }).join("");

  return `<div class="pa-ledger"><table><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table></div>`;
}

/** 「向いている人 / 向かない人」の2行を付箋に。 */
function renderFit(ok: string, ng: string): string {
  return `<div class="pa-fit">
<div class="ok"><b>向いている人</b>${inline(ok)}</div>
<div class="ng"><b>向かない人</b>${inline(ng)}</div>
</div>`;
}

/** 番号つきの手順を、番号バッジつきのステップに。 */
function renderSteps(items: string[]): string {
  const cards = items.map((s, i) => {
    const m = s.match(/^\*\*(.+?)\*\*[：:]\s*(.*)$/);
    const t = m ? m[1] : s;
    const d = m ? m[2] : "";
    return `<div class="pa-step"><div class="no num">${i + 1}</div><div>
<div class="t">${inline(t)}</div>${d ? `<div class="d">${inline(d)}</div>` : ""}
</div></div>`;
  });
  return `<div class="pa-steps">${cards.join('<div class="pa-arrow">↓</div>')}</div>`;
}

/**
 * 記事本文をA案のHTMLに変換する。
 * chartHtml は「まず結論」の直後に差し込むコスト比較グラフ。
 */
export function renderArticle(md: string, slug: string, chartHtml?: string): string {
  const list = products(slug);
  const lines = md.split("\n");
  const out: string[] = [];
  let buf: string[] = [];       // 通常のMarkdownを溜めるバッファ
  let chartDone = false;

  const flush = () => {
    if (buf.length) { out.push(marked.parse(buf.join("\n")) as string); buf = []; }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // HTMLコメント（meta-description）は落とす
    if (/^\s*<!--/.test(line)) continue;

    // 比較表
    if (line.trim().startsWith("|")) {
      const block: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) block.push(lines[i++]);
      i--;
      flush();
      out.push(renderLedger(block, list));
      // 比較表の直後にコスト比較グラフを置く
      if (chartHtml && !chartDone) {
        out.push(`<figure class="pa-fig">${chartHtml}<figcaption>記事の比較表と同じ値をグラフにしたものです。数値は内容量と一般的な使用量からの概算で、実際の使用量には個人差があります。</figcaption></figure>`);
        chartDone = true;
      }
      continue;
    }

    // 向いている人 / 向かない人（2行セット）
    const okM = line.match(/^-\s*\*\*向いている人\*\*[：:]\s*(.*)$/);
    if (okM) {
      const ngM = (lines[i + 1] || "").match(/^-\s*\*\*向かない人\*\*[：:]\s*(.*)$/);
      if (ngM) { flush(); out.push(renderFit(okM[1], ngM[1])); i++; continue; }
    }

    // 番号つきの手順（3件以上続くとき）
    if (/^\d+\.\s+\*\*/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s+/, "")); i++;
      }
      i--;
      if (items.length >= 3) { flush(); out.push(renderSteps(items)); continue; }
      buf.push(...items.map((s, n) => `${n + 1}. ${s}`));
      continue;
    }

    // FAQ（**Q. …** の次行が A. …）
    const qM = line.match(/^\*\*Q\.\s*(.+?)\*\*\s*$/);
    if (qM) {
      const a = (lines[i + 1] || "").replace(/^A\.\s*/, "");
      flush();
      out.push(`<dl class="pa-qa"><dt>${inline(qM[1])}</dt><dd>${inline(a)}</dd></dl>`);
      i++;
      continue;
    }

    // 引用（> …）はメモ用紙にする
    if (line.trim().startsWith(">")) {
      const block: string[] = [];
      while (i < lines.length && (lines[i].trim().startsWith(">") || !lines[i].trim())) {
        if (!lines[i].trim() && !lines[i + 1]?.trim().startsWith(">")) break;
        block.push(lines[i].replace(/^\s*>\s?/, "")); i++;
      }
      i--;
      flush();
      out.push(`<div class="pa-memo"><span class="pa-memo-label">補足</span>${
        marked.parse(block.join("\n")) as string
      }</div>`);
      continue;
    }

    buf.push(line);
  }
  flush();

  let html = out.join("\n");
  // 外部リンクは別タブ＋rel（アフィリンクの規約・SEO対応）
  html = html.replace(
    /<a href="(https?:\/\/(?!rakuten-affiliate-blog)[^"]+)"(?![^>]*target)/g,
    '<a href="$1" target="_blank" rel="sponsored nofollow noopener"'
  );
  return html;
}
