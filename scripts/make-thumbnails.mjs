// 記事のサムネイル画像(1280x670)を生成する。
//   使い方: npm run thumb            … 全記事
//           npm run thumb oral-care  … 1記事だけ
// 出力先: thumbnails/<slug>.png
//
// 画像生成AIは使わず、記事のタイトル・カテゴリを流し込んだHTMLを
// ヘッドレスブラウザで描画してスクリーンショットする。
// 日本語フォントがそのまま使え、毎回同じ仕上がりになるため運用が安定する。
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import matter from "gray-matter";
import { chromium } from "playwright";
import { SITE_NAME, CATEGORY_STYLE } from "./thumbnail-style.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const CONTENT_DIR = path.join(ROOT, "content");
const OUT_DIR = path.join(ROOT, "thumbnails");

const W = 1280;
const H = 670;

/** タイトルを「主題」と「サブ」に割る（｜ で区切られている前提、無ければ全体を主題に） */
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
    <span class="count">6商品を正直比較</span>
  </div>
  <div class="body">
    <h1>${main}</h1>
    ${sub ? `<p class="sub">${sub}</p>` : ""}
  </div>
  <div class="foot">
    <span class="site">${SITE_NAME}</span>
    <span class="note">価格・レビューは楽天市場の実データ</span>
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
    console.log(`  ✓ thumbnails/${slug}.png  (${W}x${H} / ${kb}KB)`);
  }
  await browser.close();
  console.log(`\n${slugs.length} 枚のサムネイルを生成しました。`);
}

main();
