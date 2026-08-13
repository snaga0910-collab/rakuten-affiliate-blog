// Pinterest用の縦長ピン画像(1000x1500)を生成する。
//   使い方: npm run pins            … 全記事
//           npm run pins oral-care  … 1記事だけ
// 出力先: pins/<slug>-{table,price,compare}.png
//
// 1記事につき切り口違いで3枚つくる。Pinterestは検索エンジンなので、
// 同じ記事でも切り口が違えば拾われる範囲が広がる。
//   table   : 比較表の「商品名 × 1回あたりコスト」をそのまま載せた一覧
//   price   : 1回あたりコストなど「数字」で引く
//   compare : 「6商品を比較」で引く
//
// 2026-08-11 に「悩み訴求（〜していませんか）」を table に差し替えた。
// 公開24枚の実績（表示272・クリック13）で、切り口別のクリック率が
//   比較 7.5% ／ 価格 6.0% ／ 悩み 1.1%
// と悩み訴求だけが全ジャンルで落ちていたため。Pinterestの利用者は
// 答えを探しに来ているので、問いを返すピンでは止まらないと判断した。
// あわせて24枚すべて保存0だったので、「あとで見返す価値のある一覧」を
// 作って保存を取りにいく（保存数はPinterestの表示回数に効く）。
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import matter from "gray-matter";
import { chromium } from "playwright";
import { SITE_NAME, CATEGORY_STYLE } from "./thumbnail-style.mjs";
import { PIN_COPY } from "./pin-copy.mjs";
import { costTable } from "./pin-table-data.mjs";

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

/** 共通の枠（背景・カテゴリチップ・フッター）。中身だけ差し替える。 */
function frame(st, category, inner) {
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
  h1{font-size:96px;font-weight:800;line-height:1.34;letter-spacing:-.01em;}
  .lead{margin-top:34px;font-size:37px;font-weight:600;color:#454c53;line-height:1.55;}
  ul{position:relative;z-index:1;list-style:none;margin:18px 0;}
  li{display:flex;align-items:flex-start;gap:18px;font-size:36px;font-weight:600;
    line-height:1.5;margin-bottom:26px;color:#2c3238;}
  .dot{flex:none;width:17px;height:17px;border-radius:50%;background:${st.accent};margin-top:14px;}
  .foot{position:relative;z-index:1;border-top:4px solid ${st.accent};padding-top:28px;}
  .cta{font-size:34px;font-weight:700;color:${st.accent};margin-bottom:12px;}
  .site{font-size:30px;font-weight:700;}
  .note{font-size:24px;color:#6b7178;margin-top:8px;}
  /* コスト一覧 */
  .t-head h1{font-size:78px;line-height:1.26;}
  .t-sub{margin-top:20px;font-size:38px;font-weight:700;color:${st.accent};}
  .rows{position:relative;z-index:1;margin:14px 0;}
  .row{display:flex;align-items:baseline;gap:20px;padding:20px 0;
    border-bottom:2px solid rgba(31,35,40,.13);}
  .row:first-child{border-top:2px solid rgba(31,35,40,.13);}
  .r-name{flex:1;font-size:34px;font-weight:600;color:#2c3238;line-height:1.35;}
  .r-cost{flex:none;font-size:44px;font-weight:800;letter-spacing:-.01em;}
  .best .r-cost{color:${st.accent};}
  .badge{flex:none;background:${st.accent};color:#fff;font-size:23px;font-weight:700;
    padding:6px 15px;border-radius:999px;}
  .spacer{flex:none;width:71px;}
</style></head><body>
  <div class="deco">${st.emoji}</div>
  ${inner}
  <div class="foot">
    <div class="cta">全項目の比較表はブログで →</div>
    <div class="site">${SITE_NAME}</div>
    <div class="note">価格・レビューは楽天市場の実データ／PR</div>
  </div>
</body></html>`;
}

/** コスト一覧ピン。記事の比較表をそのまま画像にして、保存される形にする。 */
function buildTableHtml(slug, category, copy) {
  // copy.table があればそれを使う（記事の比較表ではない一覧を出したいとき）
  const t = copy.table ?? costTable(copy.article ?? slug);
  if (!t) return null;
  const st = CATEGORY_STYLE[slug] || CATEGORY_STYLE._default;
  // 行数が多いほど1行を詰める（6行で収まるように）
  const rows = t.rows.slice(0, 6).map((r) => ({ ...r, name: r.name ?? r.full }));
  const min = rows[0].yen;
  const body = rows
    .map((r) => {
      const best = r.yen === min;
      return `<div class="row${best ? " best" : ""}">
      <span class="r-name">${esc(r.name)}</span>
      <span class="r-cost">${esc(r.cost)}</span>
      ${best ? '<span class="badge">最小</span>' : '<span class="spacer"></span>'}
    </div>`;
    })
    .join("");
  return frame(
    st,
    category,
    `<div class="head-area t-head">
    <span class="chip">${esc(category)}</span>
    <h1>${esc(t.subject)}</h1>
    <p class="t-sub">${rows.length}件の${esc(/価格|コスト$/.test(t.label) ? t.label : t.label + "コスト")}</p>
  </div>
  <div class="rows">${body}</div>`
  );
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
  return frame(
    st,
    copy.category,
    `<div class="head-area">
    <span class="chip">${esc(copy.category)}</span>
    <h1 style="font-size:${size}px">${escMultiline(v.head)}</h1>
    <p class="lead">${esc(v.lead)}</p>
  </div>
  <ul>${items}</ul>`
  );
}

async function main() {
  const target = process.argv[2];
  // PIN_COPY を正としてピンを作る。article を持つトピックは、その記事にリンクする
  const slugs = (target ? [target] : Object.keys(PIN_COPY)).filter((s) => {
    const a = PIN_COPY[s]?.article ?? s;
    return fs.existsSync(path.join(CONTENT_DIR, `${a}.md`));
  });
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
    const { data } = matter(
      fs.readFileSync(path.join(CONTENT_DIR, `${copy.article ?? slug}.md`), "utf8")
    );
    copy.category = copy.category || String(data.category || "");

    for (const variant of ["table", "price", "compare"]) {
      const html =
        variant === "table"
          ? buildTableHtml(slug, copy.category, copy)
          : buildHtml(slug, variant, copy);
      if (!html) {
        console.log(`  ⚠ ${slug}-${variant}: 比較表からコストを取れずスキップ`);
        continue;
      }
      await page.setContent(html, { waitUntil: "load" });
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
