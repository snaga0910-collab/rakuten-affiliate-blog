// 記事のサムネイル画像(1280x670)を生成する。
//   使い方: npm run thumb            … 全記事
//           npm run thumb oral-care  … 1記事だけ
// 出力先: public/thumbnails/<slug>.png（OGP画像として配信するので public/ に置く）
//
// 画像生成AIは使わず、記事のタイトル・カテゴリを流し込んだHTMLを
// ヘッドレスブラウザで描画してスクリーンショットする。
// 日本語フォントがそのまま使え、毎回同じ仕上がりになるため運用が安定する。
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import matter from "gray-matter";
import { chromium } from "playwright";
import { SITE_NAME, SITE_TAGLINE, CATEGORY_STYLE } from "./thumbnail-style.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const CONTENT_DIR = path.join(ROOT, "content");
const OUT_DIR = path.join(ROOT, "public", "thumbnails");

const W = 1280;
const H = 670;

/** タイトルを「主題」と「サブ」に割る（｜ で区切られている前提、無ければ全体を主題に） */
// サムネイル右上の一言。記事ごとに比較対象の数と単位が違う。
// 未登録の記事は「実データで正直比較」にフォールバックする。
// 記事によっては「楽天の実データ」も「各社の公表情報」も当てはまらない。
// 例: 部屋干し臭の記事は、自サイトの各比較記事から数字を引いている。
const THUMB_NOTE = {
  "laundry-odor": "各比較記事の実データより",
  "video-streaming": "料金は各社の公表情報",
  "water-cost": "各比較記事と楽天の実データ",
};

const THUMB_COUNT = {
  "hikari-internet": "4社を正直比較",
  "meal-delivery": "3社を正直比較",
  "laundry-odor": "お金をかけない順に",
  "clothes-deodorant": "6商品を正直比較",
  "video-streaming": "5サービスを正直比較",
  "water-cost": "4通りを年額で比較",
  "water-purifier-server": "3社を正直比較",
  "water-server": "3社を正直比較",
  "perfume": "6商品を正直比較",
  "oral-care": "洗口液3＋歯間ケア3",
  "fabric-softener": "6商品を正直比較",
  "coffee-drip": "6商品を正直比較",
  "water-filter": "6商品を正直比較",
  "laundry-detergent": "5商品を正直比較",
  "dishwasher-detergent": "5商品を正直比較",
  "toothbrush-head": "6商品を正直比較",
  "dish-soap": "6商品を正直比較",
  "toothpaste": "6商品を正直比較",
  "shampoo": "6商品を正直比較",
  "washer-cleaner": "6商品を正直比較",
  "diatomite-bathmat": "6商品を正直比較",
};

function splitTitle(title) {
  const i = title.indexOf("｜");
  if (i === -1) return { main: title, sub: "" };
  return { main: title.slice(0, i).trim(), sub: title.slice(i + 1).trim() };
}

function buildHtml(meta) {
  const { main, sub } = splitTitle(meta.title);
  const style = CATEGORY_STYLE[meta.slug] || CATEGORY_STYLE._default;
  // タイトルが長いときは少し小さくして、3行に収まるようにする
  const mainSize = main.length > 22 ? 62 : main.length > 16 ? 72 : 82;
  // サムネイルの「N商品を正直比較」と出典表記は、以前は全記事で固定文だった。
  // 4社比較の光回線に「6商品を正直比較」と出たり、楽天を一切使っていない記事に
  // 「価格・レビューは楽天市場の実データ」と出ていたため、記事から判定する。
  // サイト全体用（_site）は記事ファイルを持たないので読み込まない
  const articlePath = path.join(CONTENT_DIR, `${meta.slug}.md`);
  const raw = fs.existsSync(articlePath) ? fs.readFileSync(articlePath, "utf8") : "";
  const usesRakuten = raw.includes("hb.afl.rakuten");
  const footNote =
    THUMB_NOTE[meta.slug] ??
    (usesRakuten ? "価格・レビューは楽天市場の実データ" : "料金は各社の公表情報");
  const countLabel = THUMB_COUNT[meta.slug] ?? "実データで正直比較";

  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body {
    width:${W}px; height:${H}px; display:flex; flex-direction:column;
    justify-content:space-between; padding:72px 80px;
    font-family:"Hiragino Sans","Hiragino Kaku Gothic ProN","Noto Sans JP",sans-serif;
    background:${style.bg}; color:#1f2328; position:relative; overflow:hidden;
  }
  /* 右下の大きな絵文字を背景の飾りに使う */
  .deco {
    position:absolute; right:-40px; bottom:-70px; font-size:340px;
    opacity:.13; line-height:1; user-select:none;
  }
  .top { display:flex; align-items:center; gap:16px; position:relative; z-index:1; }
  .chip {
    background:${style.accent}; color:#fff; font-size:26px; font-weight:700;
    padding:9px 24px; border-radius:999px; letter-spacing:.02em;
  }
  .count { font-size:26px; font-weight:700; color:${style.accent}; }
  .body { position:relative; z-index:1; }
  h1 {
    font-size:${mainSize}px; font-weight:800; line-height:1.32;
    letter-spacing:-.01em; margin-bottom:22px;
  }
  .sub {
    font-size:31px; font-weight:600; line-height:1.5; color:#4a5158;
    border-left:7px solid ${style.accent}; padding-left:20px;
  }
  .foot {
    display:flex; align-items:center; justify-content:space-between;
    position:relative; z-index:1; font-size:25px; color:#5b6169;
  }
  .site { font-weight:700; color:#1f2328; }
  .note { font-size:22px; color:#767c85; }
</style></head><body>
  <div class="deco">${style.emoji}</div>
  <div class="top">
    <span class="chip">${meta.category}</span>
    <span class="count">${countLabel}</span>
  </div>
  <div class="body">
    <h1>${main}</h1>
    ${sub ? `<p class="sub">${sub}</p>` : ""}
  </div>
  <div class="foot">
    <span class="site">${SITE_NAME}</span>
    <span class="note">${footNote}</span>
  </div>
</body></html>`;
}

async function main() {
  const target = process.argv[2];
  const slugs = (
    target
      ? [target]
      : fs.readdirSync(CONTENT_DIR).filter((f) => f.endsWith(".md")).map((f) => f.replace(/\.md$/, ""))
  );
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });

  for (const slug of slugs) {
    const raw = fs.readFileSync(path.join(CONTENT_DIR, `${slug}.md`), "utf8");
    const { data } = matter(raw);
    const meta = { slug, title: String(data.title || slug), category: String(data.category || "") };
    await page.setContent(buildHtml(meta), { waitUntil: "load" });
    await page.waitForTimeout(300); // フォント適用待ち
    const out = path.join(OUT_DIR, `${slug}.png`);
    await page.screenshot({ path: out });
    const kb = Math.round(fs.statSync(out).size / 1024);
    console.log(`  ✓ public/thumbnails/${slug}.png  (${W}x${H} / ${kb}KB)`);
  }
  // トップページ・About等のOGP用に、サイト共通の1枚も作っておく
  if (!target) {
    await page.setContent(
      buildHtml({ slug: "_site", title: `${SITE_NAME}｜${SITE_TAGLINE}`, category: "消耗品の比較" }),
      { waitUntil: "load" }
    );
    await page.waitForTimeout(300);
    const out = path.join(OUT_DIR, "site.png");
    await page.screenshot({ path: out });
    console.log(`  ✓ public/thumbnails/site.png  (${W}x${H} / ${Math.round(fs.statSync(out).size / 1024)}KB)`);
  }

  await browser.close();
  console.log(`\n${slugs.length} 枚のサムネイルを生成しました。`);
}

main();
