// Pinterest用の縦長ピン画像(1000x1500)を生成する。
//   使い方: npm run pins            … 全記事
//           npm run pins oral-care  … 1記事だけ
// 出力先: pins/<slug>-{price,pain,compare}.png
//
// 1記事につき訴求違いで3枚つくる。Pinterestは検索エンジンなので、
// 同じ記事でも切り口の違うピンを複数出したほうが拾われる範囲が広がる。
//   price   : 1回あたりコストなど「数字」で引く
//   pain    : 読者の悩みで引く
//   compare : 「6商品を比較」で引く
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import matter from "gray-matter";
import { chromium } from "playwright";
import { SITE_NAME, CATEGORY_STYLE } from "./thumbnail-style.mjs";
import { PIN_COPY } from "./pin-copy.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const CONTENT_DIR = path.join(ROOT, "content");
const OUT_DIR = path.join(ROOT, "pins");

const W = 1000;
const H = 1500;

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** 見出しの改行(\n)をそのまま反映させる。 */
function escMultiline(s) {
  return esc(s).replace(/\n/g, "<br>");
}

function buildHtml(slug, variant, copy) {
  const st = CATEGORY_STYLE[slug] || CATEGORY_STYLE._default;
  const v = copy[variant];
  // 見出しは長さで自動的にサイズを落とす
  // 改行を除いた実文字数で判定する
  const headLen = v.head.replace(/\n/g, "").length;
  const size = headLen > 26 ? 74 : headLen > 18 ? 84 : 96;
  const items = v.points
    .map((p) => `<li><span class="dot"></span>${esc(p)}</li>`)
    .join("");
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><style>
  *{margin:0;padding:0;box-sizing:border-box;}
  body{
    width:${W}px;height:${H}px;padding:78px 66px;
    display:flex;flex-direction:column;justify-content:space-between;
    font-family:"Hiragino Sans","Hiragino Kaku Gothic ProN","Noto Sans JP",sans-serif;
    background:${st.bg};color:#1f2328;position:relative;overflow:hidden;
  }
  .deco{position:absolute;right:-70px;bottom:120px;font-size:400px;opacity:.12;line-height:1;}
  .head-area{position:relative;z-index:1;}
  .chip{display:inline-block;background:${st.accent};color:#fff;font-size:30px;
    font-weight:700;padding:11px 30px;border-radius:999px;margin-bottom:44px;}
  h1{font-size:${size}px;font-weight:800;line-height:1.34;letter-spacing:-.01em;}
  .lead{margin-top:34px;font-size:37px;font-weight:600;color:#454c53;line-height:1.55;}
  ul{position:relative;z-index:1;list-style:none;margin:18px 0;}
  li{display:flex;align-items:flex-start;gap:18px;font-size:36px;font-weight:600;
    line-height:1.5;margin-bottom:26px;color:#2c3238;}
  .dot{flex:none;width:17px;height:17px;border-radius:50%;background:${st.accent};margin-top:14px;}
  .foot{position:relative;z-index:1;border-top:4px solid ${st.accent};padding-top:28px;}
  .cta{font-size:34px;font-weight:700;color:${st.accent};margin-bottom:12px;}
  .site{font-size:30px;font-weight:700;}
  .note{font-size:24px;color:#6b7178;margin-top:8px;}
</style></head><body>
  <div class="deco">${st.emoji}</div>
  <div class="head-area">
    <span class="chip">${esc(copy.category)}</span>
    <h1>${escMultiline(v.head)}</h1>
    <p class="lead">${esc(v.lead)}</p>
  </div>
  <ul>${items}</ul>
  <div class="foot">
    <div class="cta">くわしい比較表はブログで →</div>
    <div class="site">${SITE_NAME}</div>
    <div class="note">価格・レビューは楽天市場の実データ／PR</div>
  </div>
</body></html>`;
}

async function main() {
  const target = process.argv[2];
  const slugs = target
    ? [target]
    : fs.readdirSync(CONTENT_DIR).filter((f) => f.endsWith(".md")).map((f) => f.replace(/\.md$/, ""));
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  let n = 0;

  for (const slug of slugs) {
    const copy = PIN_COPY[slug];
    if (!copy) {
      console.log(`  ⚠ ${slug}: pin-copy.mjs に文言が未定義のためスキップ`);
      continue;
    }
    // カテゴリは記事のfrontmatterから補う
    const { data } = matter(fs.readFileSync(path.join(CONTENT_DIR, `${slug}.md`), "utf8"));
    copy.category = copy.category || String(data.category || "");

    for (const variant of ["price", "pain", "compare"]) {
      await page.setContent(buildHtml(slug, variant, copy), { waitUntil: "load" });
      await page.waitForTimeout(250);
      const out = path.join(OUT_DIR, `${slug}-${variant}.png`);
      await page.screenshot({ path: out });
      console.log(`  ✓ pins/${slug}-${variant}.png (${Math.round(fs.statSync(out).size / 1024)}KB)`);
      n++;
    }
  }
  await browser.close();
  console.log(`\n${n} 枚のピンを生成しました（${W}x${H}）。`);
}

main();
