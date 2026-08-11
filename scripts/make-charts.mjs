// 記事の比較表から「1回あたりコスト」を読み取り、横棒グラフのSVGを生成する。
//   使い方: npm run charts            … 全記事
//           npm run charts oral-care  … 1記事だけ
// 出力先: public/charts/<slug>-cost.svg
//
// 数値は記事本文の比較表から抜き出すので、記事とグラフが食い違わない。
// SVGにしておくと、拡大しても粗くならず、ダークモードにも追従できる。
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import matter from "gray-matter";
import { CATEGORY_STYLE } from "./thumbnail-style.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const CONTENT_DIR = path.join(ROOT, "content");
const OUT_DIR = path.join(ROOT, "public", "charts");

/** 比較表の行から {name, cost, unitLabel} を取り出す。 */
function parseRows(md) {
  const rows = md.split("\n").filter((l) => l.trim().startsWith("| ["));
  const items = [];
  for (const r of rows) {
    const cells = r.replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
    const nameCell = cells[0] || "";
    const name = nameCell.replace(/\[([^\]]+)\]\([^)]*\)/, "$1").replace(/\*\*/g, "").trim();
    // 「約37円」「約21〜25円」「約975円」を拾う。範囲は下限を採用し、幅も持っておく
    let cost = null, range = null;
    for (const c of cells.slice(1)) {
      const m = c.match(/約([\d,]+(?:\.\d+)?)(?:〜([\d,]+(?:\.\d+)?))?円/);
      if (m) {
        cost = Number(m[1].replace(/,/g, ""));
        if (m[2]) range = Number(m[2].replace(/,/g, ""));
        break;
      }
    }
    if (cost !== null) items.push({ name, cost, range });
  }
  return items;
}

/** 見出しから単位ラベルを決める（1回/1杯/1個 など）。 */
function unitOf(md) {
  if (/1杯あたり/.test(md)) return "1杯あたり";
  if (/1個あたり/.test(md)) return "1個あたり";
  return "1回あたり";
}

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** 商品名を短くする（グラフの軸ラベル用）。
 *
 * 先頭にブランド名が来るようにする。軸ラベルは幅が限られるので、
 * 「薬用リステリン トータルケア」のような修飾語つきの正式名は
 * ブランド名だけに寄せたほうが、どの商品か一目で分かる。
 */
const BRAND = [
  "モンダミン", "リステリン", "コンクール", "クリニカ", "GUM", "ジェットウォッシャー",
  "レノア", "ハミング", "ソフラン", "ランドリン", "ファーファ", "ラボン",
  "UCC", "澤井珈琲", "キーコーヒー", "カフェ工房", "辻本珈琲", "スターバックス",
  "ブリタ", "クリンスイ", "トレビーノ", "パナソニック",
  "アタックZERO", "アタック抗菌EX", "ナノックス", "さらさ", "ボールド",
];
function shortName(n) {
  const hit = BRAND.find((b) => n.includes(b));
  if (!hit) {
    return n.replace(/【.*?】/g, "").replace(/（.*?）/g, "").trim().slice(0, 12);
  }
  // ブランド名以降を採用しつつ、長すぎる修飾は落とす
  const rest = n.slice(n.indexOf(hit)).replace(/（.*?）/g, "").trim();
  return rest.length > 12 ? rest.slice(0, 11) + "…" : rest;
}

function buildSvg(items, unit, accent) {
  const rowH = 40;
  const padT = 52, padB = 34, padL = 178, padR = 66;
  const w = 720;
  const h = padT + items.length * rowH + padB;
  const barW = w - padL - padR;
  const max = Math.max(...items.map((d) => d.range || d.cost));

  const bars = items
    .map((d, i) => {
      const y = padT + i * rowH;
      const len = Math.max(3, (d.cost / max) * barW);
      const rangeLen = d.range ? (d.range / max) * barW : 0;
      const label = d.range ? `${d.cost}〜${d.range}円` : `${d.cost}円`;
      const cheapest = d.cost === Math.min(...items.map((x) => x.cost));
      return `
  <text x="0" y="${y + 19}" class="lbl">${esc(shortName(d.name))}</text>
  <rect x="${padL}" y="${y + 6}" width="${barW}" height="22" rx="4" class="track"/>
  ${d.range ? `<rect x="${padL + len}" y="${y + 6}" width="${rangeLen - len}" height="22" rx="4" class="rng"/>` : ""}
  <rect x="${padL}" y="${y + 6}" width="${len}" height="22" rx="4" class="${cheapest ? "bar hi" : "bar"}"/>
  <text x="${padL + (d.range ? rangeLen : len) + 10}" y="${y + 22}" class="val${cheapest ? " valhi" : ""}">${esc(label)}</text>`;
    })
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(unit)}のコスト比較">
<style>
  .ttl{font:600 15px "Hiragino Sans","Noto Sans JP",system-ui,sans-serif;fill:#1c1f23}
  .sub{font:400 12px "Hiragino Sans",system-ui,sans-serif;fill:#6d6a65}
  .lbl{font:400 13px "Hiragino Sans","Noto Sans JP",system-ui,sans-serif;fill:#3b3f45}
  .val{font:600 13px ui-monospace,SFMono-Regular,Menlo,monospace;fill:#3b3f45;font-variant-numeric:tabular-nums}
  .valhi{fill:${accent}}
  .track{fill:#eeece8}
  .bar{fill:${accent};opacity:.42}
  .bar.hi{opacity:1}
  .rng{fill:${accent};opacity:.18}
  @media (prefers-color-scheme:dark){
    .ttl{fill:#e8e6e1}.sub{fill:#9a968f}.lbl{fill:#c9c6c1}.val{fill:#c9c6c1}
    .track{fill:#2b2e33}
  }
</style>
<text x="0" y="20" class="ttl">${esc(unit)}のコスト比較</text>
<text x="0" y="38" class="sub">数値は内容量と一般的な使用量からの概算（記事本文の比較表と同じ値）</text>
${bars}
</svg>`;
}

const target = process.argv[2];
const slugs = target
  ? [target]
  : fs.readdirSync(CONTENT_DIR).filter((f) => f.endsWith(".md")).map((f) => f.replace(/\.md$/, ""));

fs.mkdirSync(OUT_DIR, { recursive: true });
let made = 0;
for (const slug of slugs) {
  const { content } = matter(fs.readFileSync(path.join(CONTENT_DIR, `${slug}.md`), "utf8"));
  const items = parseRows(content);
  if (items.length < 2) {
    console.log(`  − ${slug}: コスト値が2件未満のためスキップ`);
    continue;
  }
  const accent = (CATEGORY_STYLE[slug] || CATEGORY_STYLE._default).accent;
  // 安い順に並べると比較が読み取りやすい
  items.sort((a, b) => a.cost - b.cost);
  const svg = buildSvg(items, unitOf(content), accent);
  fs.writeFileSync(path.join(OUT_DIR, `${slug}-cost.svg`), svg, "utf8");
  console.log(`  ✓ public/charts/${slug}-cost.svg  (${items.length}商品 / ${items[0].cost}円〜)`);
  made++;
}
console.log(`\n${made} 枚のコスト比較グラフを生成しました。`);
