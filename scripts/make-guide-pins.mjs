// 「保存されるか」を検証するピンを作る。
//   使い方: npm run guidepins
// 出力先: pins/guide-<id>.png（1000x1500）
//
// 既存のピン（make-pins.mjs）は記事1本ごとの価格比較表だが、こちらは記事を
// またいだ早見表と手順もの。1枚で完結するぶん、記事へのクリックは減るかも
// しれないが、いまはクリックも0なので失うものがない。
// 見た目は既存のピンと揃える（同じ人が作っていると分かるように）。
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { chromium } from "playwright";
import { SITE_NAME } from "./thumbnail-style.mjs";
import { GUIDE_PINS } from "./guide-pin-data.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "pins");
const W = 1000;
const H = 1500;

// 「買い替えの目安」は落ち着いた青、「買い物のとき用」は緑、「部屋干し」は既存に合わせる
const STYLE = {
  "買い替えの目安": { bg: "#eef3f7", accent: "#26557f" },
  "買い物のとき用": { bg: "#f0f4ee", accent: "#3f6b34" },
  "部屋干し": { bg: "#eef3f0", accent: "#2f6b52" },
};

const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

/** 主役の文字は長さで縮める（折り返すと単位だけ次行に落ちて読めない） */
const fit = (t, sizes) => sizes.find(([n]) => t.length <= n)[1];
const HERO = [[7, 104], [10, 88], [14, 74], [Infinity, 62]];

function frame(st, category, inner, footNote, cta) {
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{width:${W}px;height:${H}px;padding:70px 62px 58px;display:flex;flex-direction:column;
    justify-content:space-between;background:${st.bg};color:#22282e;
    font-family:"Hiragino Sans","Hiragino Kaku Gothic ProN","Noto Sans JP",sans-serif;}
  .chip{display:inline-block;background:${st.accent};color:#fff;font-size:29px;font-weight:800;
    padding:9px 28px;border-radius:999px;letter-spacing:.03em;margin-bottom:26px;}
  .subject{font-size:52px;font-weight:800;line-height:1.25;letter-spacing:-.01em;}
  .label{font-size:31px;font-weight:600;color:#5b6169;margin-top:10px;}
  .hero{font-weight:800;color:${st.accent};letter-spacing:-.02em;line-height:1.1;margin-top:18px;
    white-space:nowrap;}
  .count{font-size:26px;font-weight:700;color:#6a727a;margin-bottom:14px;letter-spacing:.02em;}
  .rows{border-top:2px solid rgba(34,40,46,.14);}
  .row{display:flex;align-items:center;gap:16px;padding:22px 2px;
    border-bottom:1px solid rgba(34,40,46,.10);}
  .r-name{flex:1;min-width:0;font-size:40px;font-weight:600;line-height:1.25;
    white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
  .r-val{flex:none;font-size:46px;font-weight:800;letter-spacing:-.02em;color:${st.accent};}
  .note{font-size:25px;color:#5b6169;line-height:1.5;margin-top:22px;}
  .lead{font-size:34px;font-weight:700;color:#3d454c;line-height:1.45;margin:22px 0 30px;}
  .pt{display:flex;gap:18px;align-items:flex-start;margin-bottom:24px;}
  .dot{flex:none;width:15px;height:15px;border-radius:50%;background:${st.accent};margin-top:16px;}
  .pt span{font-size:39px;font-weight:600;line-height:1.4;}
  .foot{border-top:3px solid ${st.accent};padding-top:22px;}
  .cta{font-size:36px;font-weight:800;color:${st.accent};margin-bottom:10px;}
  .site{font-size:30px;font-weight:700;}
  .src{font-size:23px;color:#767c85;margin-top:6px;}
</style></head><body>
  <div>${inner}</div>
  <div class="foot">
    <div class="cta">${esc(cta)}</div>
    <div class="site">${SITE_NAME}</div>
    <div class="src">${esc(footNote)}</div>
  </div>
</body></html>`;
}

function tableHtml(p, st) {
  const rows = p.rows
    .map(
      (r) =>
        `<div class="row"><div class="r-name">${esc(r.name)}</div><div class="r-val">${esc(r.cost)}</div></div>`
    )
    .join("");
  return frame(
    st,
    p.category,
    `<div class="chip">${esc(p.category)}</div>
     <div class="subject">${esc(p.subject)}</div>
     <div class="label">${esc(p.label)}</div>
     <div class="hero" style="font-size:${fit(p.hero, HERO)}px">${esc(p.hero)}</div>
     <div style="margin-top:44px">
       <div class="count">${esc(p.countLabel)}</div>
       <div class="rows">${rows}</div>
       ${p.note ? `<div class="note">${esc(p.note)}</div>` : ""}
     </div>`,
    p.footNote,
    p.cta
  );
}

function compareHtml(p, st) {
  const head = esc(p.head).split("\n").join("<br>");
  const pts = p.points
    .map((t) => `<div class="pt"><div class="dot"></div><span>${esc(t)}</span></div>`)
    .join("");
  return frame(
    st,
    p.category,
    `<div class="chip">${esc(p.category)}</div>
     <div class="subject" style="font-size:60px">${head}</div>
     <div class="lead">${esc(p.lead)}</div>
     <div style="margin-top:36px">${pts}</div>`,
    p.footNote,
    p.cta
  );
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });

  for (const p of GUIDE_PINS) {
    const st = STYLE[p.category] ?? STYLE["買い替えの目安"];
    await page.setContent(p.kind === "table" ? tableHtml(p, st) : compareHtml(p, st), {
      waitUntil: "load",
    });
    await page.waitForTimeout(300);
    const out = path.join(OUT_DIR, `guide-${p.id}.png`);
    await page.screenshot({ path: out });
    console.log(`  ✓ pins/guide-${p.id}.png  (${Math.round(fs.statSync(out).size / 1024)}KB)`);
  }

  await browser.close();
  console.log(`\n${GUIDE_PINS.length} 枚の検証用ピンを生成しました。`);
}

main();
