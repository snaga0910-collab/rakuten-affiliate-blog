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


/**
 * 共通の枠（背景・カテゴリチップ・フッター）。中身だけ差し替える。
 *
 * 2026-08-16 に文字を全体的に大きくした。Pinterestのフィードでピンが出る幅は
 * 約236pxで、1000px幅で作った画像は23%に縮む。旧デザインは一覧の行が34px
 * ＝実寸8px相当で、フィードでは読めていなかった（30日間で保存0・流入0）。
 * 「フィードで止めるのは大きな数字、拡大して読むのが一覧」の役割分担にする。
 *
 * 背景の巨大絵文字（opacity .12）も廃止した。実寸では何か判別できないうえ、
 * 文字とのコントラストを下げていたため。
 *
 * 楽天の商品画像はピンに載せない。ガイドライン上、商品画像は
 * 「アフィリエイトリンクとセットで」使うものとされており、ピンのリンク先は
 * 自分のブログでピン自体にアフィリンクがないため。ブログ記事内での使用は問題ない。
 */
function frame(st, category, inner, footNote) {
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><style>
  *{margin:0;padding:0;box-sizing:border-box;}
  body{
    width:${W}px;height:${H}px;padding:70px 62px;
    display:flex;flex-direction:column;justify-content:space-between;
    font-family:"Hiragino Sans","Hiragino Kaku Gothic ProN","Noto Sans JP",sans-serif;
    background:${st.bg};color:#161a1e;position:relative;overflow:hidden;
  }
  .head-area{position:relative;z-index:1;}
  .chip{display:inline-block;background:${st.accent};color:#fff;font-size:32px;
    font-weight:700;padding:12px 32px;border-radius:999px;margin-bottom:34px;}
  /* 主題は小さく、2行目の数字を主役にする */
  .subject{font-weight:700;line-height:1.25;color:#3a4148;letter-spacing:-.01em;}
  .hero{font-weight:800;line-height:1.14;color:${st.accent};letter-spacing:-.025em;
    margin-top:10px;}
  .lead{margin-top:28px;font-size:42px;font-weight:700;color:#2c3238;line-height:1.45;}
  ul{position:relative;z-index:1;list-style:none;margin:10px 0;}
  li{display:flex;align-items:flex-start;gap:20px;font-size:46px;font-weight:600;
    line-height:1.42;margin-bottom:30px;color:#22282e;}
  .dot{flex:none;width:20px;height:20px;border-radius:50%;background:${st.accent};margin-top:20px;}
  .foot{position:relative;z-index:1;border-top:5px solid ${st.accent};padding-top:26px;}
  .cta{font-size:38px;font-weight:800;color:${st.accent};margin-bottom:10px;}
  .site{font-size:31px;font-weight:700;color:#3a4148;}
  .note{font-size:25px;color:#6b7178;margin-top:6px;}
  /* コスト一覧 */
  .t-label{margin-top:6px;font-size:34px;font-weight:700;color:#5a6169;}
  .t-count{margin:22px 0 4px;font-size:30px;font-weight:700;color:#5a6169;}
  .rows{position:relative;z-index:1;}
  .row{display:flex;align-items:center;gap:18px;padding:17px 0;
    border-bottom:2px solid rgba(22,26,30,.15);}
  .row:first-child{border-top:2px solid rgba(22,26,30,.15);}
  /* 商品名は必ず1行に収める。折り返すと6行で枠を越えてフッターが切れる。 */
  .r-name{flex:1;min-width:0;font-size:44px;font-weight:600;color:#22282e;line-height:1.28;
    white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  .r-cost{flex:none;font-size:54px;font-weight:800;letter-spacing:-.02em;}
  .best .r-name{font-weight:700;}
  .best .r-cost{color:${st.accent};}
  .badge{flex:none;background:${st.accent};color:#fff;font-size:26px;font-weight:700;
    padding:7px 17px;border-radius:999px;}
  .spacer{flex:none;width:82px;}
</style></head><body>
  ${inner}
  <div class="foot">
    <div class="cta">全項目の比較表はブログで →</div>
    <div class="site">${SITE_NAME}</div>
    <div class="note">${footNote ?? "価格・レビューは楽天市場の実データ／PR"}</div>
  </div>
  <script>
    // 主役の数字は必ず1行に収める。折り返すと「1,999円〜7,480」「円」のように
    // 単位だけが next line に落ちて読みにくくなるため、入るまで縮める。
    (function () {
      var el = document.querySelector(".hero");
      if (!el) return;
      el.style.whiteSpace = "nowrap";
      var size = parseFloat(getComputedStyle(el).fontSize);
      while (el.scrollWidth > el.clientWidth && size > 46) {
        size -= 2;
        el.style.fontSize = size + "px";
      }
    })();
  </script>
</body></html>`;
}

/**
 * 見出し部分（カテゴリチップ＋主題）を組み立てる。
 *
 * チップは32pxでフィードでは7.5px相当しか出ないので、これだけに主題を任せない。
 * 同じ語がチップと主題で重複するときは、読めるほうの主題を残してチップを落とす。
 */
function headTop(category, subject) {
  const chip =
    category && category !== subject ? `<span class="chip">${esc(category)}</span>` : "";
  return `${chip}<div class="subject" style="font-size:${fit(subject, SUBJECT_SIZES)}px">${esc(subject)}</div>`;
}

/** 文字数に応じてフォントサイズを決める（長い文言でも枠に収める）。 */
function fit(text, steps) {
  const len = String(text).length;
  for (const [max, size] of steps) if (len <= max) return size;
  return steps[steps.length - 1][1];
}

// [文字数の上限, フォントサイズ] の順に並べる。
// 主役（hero）は縮小後も読める大きさを優先し、主題（subject）は脇役に回す。
const HERO_SIZES = [[9, 116], [13, 100], [17, 86], [22, 74], [Infinity, 64]];
const SUBJECT_SIZES = [[7, 60], [11, 52], [Infinity, 46]];

/** コスト一覧ピン。記事の比較表をそのまま画像にして、保存される形にする。 */
function buildTableHtml(slug, category, copy) {
  // copy.table があればそれを使う（記事の比較表ではない一覧を出したいとき）
  const t = copy.table ?? costTable(copy.article ?? slug);
  if (!t) return null;
  const st = CATEGORY_STYLE[slug] || CATEGORY_STYLE._default;
  // 行数が多いほど1行を詰める（6行で収まるように）
  const rows = t.rows.slice(0, 6).map((r) => ({ ...r, name: r.name ?? r.full }));
  // yen を持たない一覧（香水の「香りの系統」など、コスト順で並ばないもの）は
  // 最小バッジを出さない。その場合はバッジ幅の余白も空けない。
  const hasYen = rows.every((r) => typeof r.yen === "number");
  const min = hasYen ? Math.min(...rows.map((r) => r.yen)) : null;
  const body = rows
    .map((r) => {
      const best = hasYen && r.yen === min;
      const tail = best
        ? '<span class="badge">最小</span>'
        : hasYen
          ? '<span class="spacer"></span>'
          : "";
      return `<div class="row${best ? " best" : ""}">
      <span class="r-name">${esc(r.name)}</span>
      <span class="r-cost">${esc(r.cost)}</span>
      ${tail}
    </div>`;
    })
    .join("");
  // フィードで読ませるのは一覧ではなくこの幅。最安と最高だけを大きく出す。
  // 「約21〜25円」のように1つのセルに幅が入っている記事があるので、
  // セル内の数値をすべて見て本当の最小・最大を取る。
  // cost の文字列をそのまま繋ぐと「13円〜21〜25円」になってしまう。
  //
  // コストが主役でない記事は pin-copy.mjs 側で hero を手書きする。
  const nums = rows.flatMap((r) =>
    [...String(r.cost).matchAll(/[\d,]+(?:\.\d+)?/g)].map((m) => Number(m[0].replace(/,/g, "")))
  );
  const yen = (n) => `${n.toLocaleString("ja-JP")}円`;
  const range = t.hero ?? (nums.length ? `${yen(Math.min(...nums))}〜${yen(Math.max(...nums))}` : null);
  if (!range) return null;
  const label = t.hero || /価格|コスト$/.test(t.label) ? t.label : `${t.label}コスト`;

  return frame(
    st,
    category,
    `<div class="head-area">
    ${headTop(category, t.subject)}
    <div class="t-label">${esc(label)}</div>
    <div class="hero" style="font-size:${fit(range, HERO_SIZES)}px">${esc(range)}</div>
  </div>
  <div>
    <p class="t-count">${esc(t.countLabel ?? `${rows.length}商品を比較`)}</p>
    <div class="rows">${body}</div>
  </div>`,
    copy.footNote
  );
}

function buildHtml(slug, variant, copy) {
  const st = CATEGORY_STYLE[slug] || CATEGORY_STYLE._default;
  const v = copy[variant];
  // head は "歯磨き粉\n1回2.7円〜21.9円" の形。1行目を主題、2行目以降を主役にする。
  const [subject, ...restLines] = v.head.split("\n");
  const hero = restLines.join("");
  const items = v.points
    .map((p) => `<li><span class="dot"></span>${esc(p)}</li>`)
    .join("");
  return frame(
    st,
    copy.category,
    `<div class="head-area">
    ${headTop(copy.category, subject)}
    ${hero ? `<div class="hero" style="font-size:${fit(hero, HERO_SIZES)}px">${esc(hero)}</div>` : ""}
    <p class="lead">${esc(v.lead)}</p>
  </div>
  <ul>${items}</ul>`,
    copy.footNote
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
