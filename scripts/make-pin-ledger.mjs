// pins/TODO.md から、投稿台帳のHTML（アーティファクト用）を作る。
//   使い方: node scripts/make-pin-ledger.mjs
//   出力先: pins/ledger.html
//
// 台帳を手で書き写すと、記事を直したときにピンの数字だけ古いまま残る。
// 実際に 2026-09-07 に、記事を書き直した水代のピンが旧版の数字（3,900円・
// 天然水サーバー）のままになっていた。TODO.md を唯一の出所にして、
// 台帳はそこから生成する。
//
// 1日ぶんの並び順は「既存ボードで出せるもの → ボードを作る必要があるもの」。
// 作る手間で止まらないよう、すぐ出せるものを前に置く。
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const SRC = path.join(ROOT, "pins", "TODO.md");
const OUT = path.join(ROOT, "pins", "ledger.html");

const esc = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/** TODO.md を記事ごとの塊に割って読む。 */
function parse(md) {
  const out = [];
  const blocks = md.split(/^## /m).slice(1);
  for (const b of blocks) {
    const lines = b.split("\n");
    const title = lines[0].trim();
    const board = (b.match(/- ボード: \*\*(.+?)\*\*/) || [])[1] ?? "未設定";
    const needsBoard = /このボードはまだありません/.test(b);
    const url = (b.match(/- リンク先: (\S+)/) || [])[1] ?? "";
    const pins = [];
    // 「### [ ] 変種（画像: `pins/x.png`）」＋タイトル＋説明文
    const re =
      /### \[ \] (.+?)（画像: `(.+?)`）\s*\n\s*\*\*タイトル\*\*\s*\n```\n([\s\S]*?)\n```\s*\n\*\*説明文\*\*\s*\n```\n([\s\S]*?)\n```/g;
    let m;
    while ((m = re.exec(b))) {
      pins.push({ variant: m[1], file: path.basename(m[2]), title: m[3].trim(), desc: m[4].trim() });
    }
    if (pins.length) out.push({ title, board, needsBoard, url, pins, slug: url.split("/").pop() });
  }
  // ボードを作らずに出せるものを先に
  return out.sort((a, b) => Number(a.needsBoard) - Number(b.needsBoard));
}

const days = parse(fs.readFileSync(SRC, "utf8"));
const total = days.reduce((n, d) => n + d.pins.length, 0);

const sections = days
  .map((d, i) => {
    const n = String(i + 1).padStart(2, "0");
    const warn = d.needsBoard
      ? `<div class="kv warnrow"><span class="klabel">要作成</span><span class="kval">このボードはまだありません。投稿前に作ってください</span></div>`
      : "";
    const pins = d.pins
      .map(
        (p, j) => `<li class="pin" data-pin>
<label class="box"><input type="checkbox" data-id="${esc(d.slug)}::${j}"><span class="tick" aria-hidden="true"></span><span class="sr">投稿した</span></label>
<div class="pinbody">
<div class="pinmeta"><span class="variant">${esc(p.variant)}</span><code class="file">${esc(p.file)}</code></div>
<div class="field"><span class="flabel">タイトル</span><p class="ftext">${esc(p.title)}</p><button class="copy" data-copy="${esc(p.title)}">コピー</button></div>
<div class="field"><span class="flabel">説明文</span><p class="ftext desc">${esc(p.desc)}</p><button class="copy" data-copy="${esc(p.desc)}">コピー</button></div>
</div></li>`
      )
      .join("");
    return `<section class="day" data-slug="${esc(d.slug)}" data-day="${i + 1}">
<header class="dayhead">
<span class="daynum">${n}</span>
<div class="daytitle"><h2>${esc(d.title)}</h2></div>
<span class="daycount"><b data-done>0</b>/${d.pins.length}</span>
</header>
<div class="shared">
<div class="kv"><span class="klabel">ボード</span><code class="kval">${esc(d.board)}</code><button class="copy sm" data-copy="${esc(d.board)}">コピー</button></div>
${warn}
<div class="kv"><span class="klabel">リンク先</span><code class="kval url">${esc(d.url)}</code><button class="copy sm" data-copy="${esc(d.url)}">コピー</button></div>
</div>
<ol class="pins">${pins}</ol>
</section>`;
  })
  .join("\n");

const html = `<title>Pinterest 投稿台帳</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Zen+Kaku+Gothic+New:wght@400;500;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap">
<style>
:root{
  --paper:#F4F7F8; --surface:#FFFFFF; --surface-2:#FBFCFC;
  --ink:#141A1D; --muted:#66737B; --faint:#8D9AA2;
  --line:#DBE3E6; --line-soft:#EAF0F2;
  --accent:#0E6B60; --accent-ink:#0A5148; --accent-soft:#E0EFEC;
  --warn:#8A5A12; --warn-soft:#F6EBDA; --on-accent:#FFFFFF;
  --r:10px; --maxw:920px;
}
@media (prefers-color-scheme:dark){
  :root:not([data-theme="light"]){
    --paper:#111619; --surface:#1A2126; --surface-2:#151B1F;
    --ink:#E6ECEF; --muted:#96A3AB; --faint:#75828A;
    --line:#2A333A; --line-soft:#222A30;
    --accent:#4FC2B0; --accent-ink:#7FD6C8; --accent-soft:#153029;
    --warn:#D9A85F; --warn-soft:#2E2617; --on-accent:#0C1917;
  }
}
:root[data-theme="dark"]{
  --paper:#111619; --surface:#1A2126; --surface-2:#151B1F;
  --ink:#E6ECEF; --muted:#96A3AB; --faint:#75828A;
  --line:#2A333A; --line-soft:#222A30;
  --accent:#4FC2B0; --accent-ink:#7FD6C8; --accent-soft:#153029;
  --warn:#D9A85F; --warn-soft:#2E2617; --on-accent:#0C1917;
}
*{box-sizing:border-box;margin:0;padding:0}
body{
  background:var(--paper); color:var(--ink);
  font-family:"Zen Kaku Gothic New",-apple-system,"Hiragino Sans",sans-serif;
  font-size:15px; line-height:1.75; -webkit-font-smoothing:antialiased;
  padding:0 20px 96px;
}
.wrap{max-width:var(--maxw);margin:0 auto}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
code,.mono{font-family:"IBM Plex Mono",ui-monospace,monospace;font-variant-numeric:tabular-nums}
.mast{padding:44px 0 20px}
.eyebrow{font-family:"IBM Plex Mono",monospace;font-size:11px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:var(--accent)}
.mast h1{font-size:clamp(26px,4.4vw,36px);font-weight:700;line-height:1.3;letter-spacing:-.01em;margin-top:8px;text-wrap:balance}
.lede{color:var(--muted);margin-top:10px;max-width:62ch;font-size:14px}
.status{
  position:sticky;top:0;z-index:20;background:var(--surface);
  border:1px solid var(--line);border-radius:var(--r);
  padding:16px 18px;margin:22px 0 30px;
  box-shadow:0 1px 2px rgba(0,0,0,.04),0 8px 22px -18px rgba(0,0,0,.4);
}
.stat-top{display:flex;align-items:baseline;justify-content:space-between;gap:14px;flex-wrap:wrap}
.tally{font-family:"IBM Plex Mono",monospace;font-size:15px;font-weight:600}
.tally b{font-size:26px;color:var(--accent);font-weight:600}
.tally span{color:var(--muted);font-weight:400}
.bar{height:5px;background:var(--line-soft);border-radius:99px;overflow:hidden;margin:12px 0 14px}
.bar i{display:block;height:100%;width:0;background:var(--accent);border-radius:99px;transition:width .35s ease}
.filters{display:flex;gap:7px;flex-wrap:wrap}
.filters button{font:inherit;font-size:13px;font-weight:500;padding:6px 14px;border-radius:99px;cursor:pointer;border:1px solid var(--line);background:transparent;color:var(--muted);transition:.15s}
.filters button:hover{border-color:var(--accent);color:var(--accent)}
.filters button[aria-pressed="true"]{background:var(--accent);border-color:var(--accent);color:var(--on-accent)}
.hint{margin-top:14px;padding:11px 13px;border-radius:8px;background:var(--warn-soft);color:var(--warn);font-size:13px;line-height:1.6}
.hint b{font-weight:700}
.day{background:var(--surface);border:1px solid var(--line);border-radius:var(--r);margin-bottom:16px;overflow:hidden}
.day.hide{display:none}
.day.done{opacity:.5}
.dayhead{display:flex;align-items:center;gap:16px;padding:16px 18px;border-bottom:1px solid var(--line-soft)}
.daynum{font-family:"IBM Plex Mono",monospace;font-size:22px;font-weight:600;color:var(--accent);flex:none;min-width:34px;letter-spacing:-.02em}
.daytitle{flex:1;min-width:0}
.daytitle h2{font-size:16px;font-weight:700;line-height:1.4}
.daycount{font-family:"IBM Plex Mono",monospace;font-size:13px;color:var(--faint);flex:none}
.daycount b{color:var(--ink);font-weight:600}
.day.done .daycount b{color:var(--accent)}
.shared{display:grid;gap:1px;background:var(--line-soft);border-bottom:1px solid var(--line-soft)}
.kv{display:flex;align-items:center;gap:10px;padding:9px 18px;background:var(--surface-2);min-width:0}
.kv.warnrow{background:var(--warn-soft)}
.kv.warnrow .klabel,.kv.warnrow .kval{color:var(--warn);font-weight:700}
.klabel{font-size:11.5px;color:var(--faint);flex:none;width:62px;letter-spacing:.04em}
.kval{font-size:12.5px;color:var(--ink);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.kval.url{color:var(--muted);font-size:11.5px}
.pins{list-style:none}
.pin{display:flex;gap:13px;padding:15px 18px;border-top:1px solid var(--line-soft)}
.pin:first-child{border-top:none}
.pin.on{background:var(--accent-soft)}
.pin.on .pinbody{opacity:.42}
.box{flex:none;position:relative;width:21px;height:21px;margin-top:3px;cursor:pointer}
.box input{position:absolute;inset:0;opacity:0;cursor:pointer;margin:0}
.tick{display:block;width:21px;height:21px;border:1.5px solid var(--line);border-radius:6px;background:var(--surface);transition:.15s}
.box input:checked+.tick{background:var(--accent);border-color:var(--accent)}
.box input:checked+.tick::after{content:"";position:absolute;left:7px;top:3px;width:5px;height:10px;border:solid var(--on-accent);border-width:0 2px 2px 0;transform:rotate(42deg)}
.box input:focus-visible+.tick{outline:2px solid var(--accent);outline-offset:2px}
.pinbody{flex:1;min-width:0;transition:opacity .2s}
.pinmeta{display:flex;align-items:center;gap:9px;margin-bottom:9px;flex-wrap:wrap}
.variant{font-size:11px;font-weight:700;padding:2px 9px;border-radius:99px;background:var(--accent-soft);color:var(--accent-ink)}
.file{font-family:"IBM Plex Mono",monospace;font-size:11px;color:var(--faint)}
.field{display:flex;align-items:flex-start;gap:10px;padding:7px 0;border-top:1px dashed var(--line-soft)}
.field:first-of-type{border-top:none;padding-top:0}
.flabel{font-size:11.5px;color:var(--faint);flex:none;width:52px;padding-top:2px}
.ftext{flex:1;min-width:0;font-size:14px;line-height:1.7;word-break:break-word}
.ftext.desc{font-size:13px;color:var(--muted);line-height:1.75}
.copy{flex:none;font:inherit;font-size:11.5px;font-weight:500;padding:3px 11px;border:1px solid var(--line);border-radius:6px;background:var(--surface);color:var(--muted);cursor:pointer;transition:.15s;margin-top:1px}
.copy:hover{border-color:var(--accent);color:var(--accent)}
.copy:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.copy.ok{background:var(--accent);border-color:var(--accent);color:var(--on-accent)}
.copy.warn{background:var(--warn-soft);border-color:var(--warn);color:var(--warn);font-weight:700}
.copy.sm{font-size:11px;padding:2px 9px}
::selection{background:var(--accent-soft);color:var(--ink)}
.howto{background:var(--surface);border:1px solid var(--line);border-radius:var(--r);padding:18px 20px;margin-bottom:26px}
.howto h3{font-size:13px;font-weight:700;margin-bottom:9px}
.howto ol{margin-left:1.15em;font-size:13.5px;color:var(--muted);line-height:1.85}
.howto ol li::marker{color:var(--accent);font-weight:600}
.howto p{font-size:12.5px;color:var(--faint);margin-top:9px;line-height:1.7}
.howto p b{color:var(--muted);font-weight:700}
.foot{margin-top:34px;padding-top:20px;border-top:1px solid var(--line);font-size:12.5px;color:var(--faint);line-height:1.8}
.foot b{color:var(--muted);font-weight:600}
.empty{text-align:center;padding:46px 20px;color:var(--muted);font-size:14px;display:none}
.empty.show{display:block}
@media (prefers-reduced-motion:reduce){*{transition:none!important}}
@media (max-width:600px){
  body{padding:0 14px 70px}
  .field{flex-wrap:wrap}
  .flabel{width:100%}
  .klabel{width:52px}
}
</style>

<div class="wrap">
<header class="mast">
  <div class="eyebrow">Pinterest 投稿台帳</div>
  <h1>${total}枚を6日で出す</h1>
  <p class="lede">まだ一度も出していない6記事ぶんだけを並べています。すでに投稿済みのピンは入っていないので、上から順に出せば重複しません。チェックはこの端末に保存されるので、途中で閉じても続きから再開できます。</p>
</header>

<div class="status">
  <div class="stat-top">
    <div class="tally"><b id="done">0</b> <span>/ ${total} 投稿済み</span></div>
    <div class="tally" style="font-size:13px"><span id="daylabel">Day 1 から</span></div>
  </div>
  <div class="bar"><i id="barfill"></i></div>
  <div class="filters">
    <button data-f="all" aria-pressed="true">すべて</button>
    <button data-f="todo" aria-pressed="false">未投稿だけ</button>
    <button data-f="next" aria-pressed="false">次に出すぶん</button>
  </div>
  <div class="hint" id="hint"></div>
</div>

<div class="howto">
  <h3>投稿の手順</h3>
  <ol>
    <li>Pinterest で「作成 → ピンを作成」を開く</li>
    <li><code>pins/</code> フォルダから、カードのファイル名の画像をアップロード</li>
    <li>タイトル・説明文・リンク先をコピーして貼り付け、ボードを選んで公開</li>
    <li>投稿したらチェックを入れる</li>
  </ol>
  <p><b>ドメイン認証は 2026-09-07 に新URLで完了しています。</b>そのまま投稿して大丈夫です。</p>
  <p><b>Day 5 と Day 6 はボードを作るところから</b>です。カードの「要作成」の行に出ています。1日3枚までにとどめてください（まとめて大量に出すとスパム判定を受けることがあります）。</p>
</div>

<div id="list">
${sections}
</div>
<p class="empty" id="empty">この条件に合う日はありません。</p>

<div class="foot">
  <p><b>並び順の考え方</b>：既存のボードにそのまま出せるものを先に置いています。ボードを作る手間で止まらないようにするためです。</p>
  <p><b>Day 1・Day 3 は洗濯クラスタ</b>です。Search Console の表示の4割がこの領域なので、いちばん読まれる見込みがあります。</p>
  <p><b>Day 6 は2枚だけ</b>です。調味料の記事は価格で順位を付けていないので、コスト一覧のピンを作っていません。</p>
</div>
</div>

<script>
(function(){
  var KEY="pinledger-v3";
  var state={};
  try{state=JSON.parse(localStorage.getItem(KEY)||"{}")}catch(e){state={}}
  var boxes=[].slice.call(document.querySelectorAll(".box input"));
  var days=[].slice.call(document.querySelectorAll(".day"));
  var filter="all";

  function save(){try{localStorage.setItem(KEY,JSON.stringify(state))}catch(e){}}

  function render(){
    var total=boxes.length,done=0;
    boxes.forEach(function(b){
      var on=!!state[b.dataset.id];
      b.checked=on;
      b.closest(".pin").classList.toggle("on",on);
      if(on)done++;
    });
    document.getElementById("done").textContent=done;
    document.getElementById("barfill").style.width=(total?done/total*100:0)+"%";

    var nextDay=null;
    days.forEach(function(d){
      var ins=[].slice.call(d.querySelectorAll(".box input"));
      var n=ins.filter(function(i){return state[i.dataset.id]}).length;
      d.querySelector("[data-done]").textContent=n;
      var full=n===ins.length;
      d.classList.toggle("done",full);
      if(!full&&nextDay===null)nextDay=d;
    });

    var label=document.getElementById("daylabel");
    var hint=document.getElementById("hint");
    if(nextDay){
      var dn=nextDay.dataset.day;
      var nm=nextDay.querySelector(".daytitle h2").textContent;
      var bd=nextDay.querySelector(".kv .kval").textContent;
      var need=nextDay.querySelector(".warnrow")?"　このボードはまだ作っていません。":"";
      label.textContent="次は Day "+dn;
      hint.innerHTML="<b>次に出すのは Day "+dn+"（"+nm+"）。</b>ボードは「"+bd+"」です。"+need;
    }else{
      label.textContent="全部おわり";
      hint.innerHTML="<b>"+total+"枚すべて投稿済みです。</b>10月頭に、検証用5枚の保存数だけを見てください。";
    }

    days.forEach(function(d){
      var show=true;
      if(filter==="todo")show=!d.classList.contains("done");
      if(filter==="next")show=(d===nextDay);
      d.classList.toggle("hide",!show);
    });
    var any=days.some(function(d){return !d.classList.contains("hide")});
    document.getElementById("empty").classList.toggle("show",!any);
  }

  boxes.forEach(function(b){
    b.addEventListener("change",function(){
      if(b.checked)state[b.dataset.id]=1; else delete state[b.dataset.id];
      save();render();
    });
  });

  document.querySelectorAll(".filters button").forEach(function(btn){
    btn.addEventListener("click",function(){
      filter=btn.dataset.f;
      document.querySelectorAll(".filters button").forEach(function(o){
        o.setAttribute("aria-pressed",String(o===btn));
      });
      render();
      window.scrollTo({top:0,behavior:"smooth"});
    });
  });

  // 埋め込み枠では navigator.clipboard が拒否されることがあるので、
  // (1)execCommand (2)Clipboard API (3)その場で選択（Cmd+C）の順に落とす。
  function tryExec(t){
    try{
      var ta=document.createElement("textarea");
      ta.value=t; ta.setAttribute("readonly","");
      ta.style.cssText="position:fixed;top:0;left:0;width:1px;height:1px;padding:0;border:0;opacity:0;";
      document.body.appendChild(ta);
      ta.focus(); ta.select();
      try{ta.setSelectionRange(0,t.length)}catch(e){}
      var ok=document.execCommand("copy");
      document.body.removeChild(ta);
      return ok===true;
    }catch(e){ return false; }
  }
  function selectSource(btn){
    var row=btn.closest(".field")||btn.closest(".kv");
    var el=row&&(row.querySelector(".ftext")||row.querySelector(".kval"));
    if(!el)return false;
    try{
      var r=document.createRange(); r.selectNodeContents(el);
      var sel=window.getSelection(); sel.removeAllRanges(); sel.addRange(r);
      return true;
    }catch(e){ return false; }
  }
  function flash(b,label,cls){
    var o=b.dataset.orig||b.textContent;
    b.dataset.orig=o;
    b.textContent=label; b.classList.add(cls);
    clearTimeout(b._t);
    b._t=setTimeout(function(){b.textContent=o;b.classList.remove("ok","warn")},2200);
  }

  document.addEventListener("click",function(e){
    var b=e.target.closest(".copy"); if(!b)return;
    var t=b.getAttribute("data-copy")||"";
    if(tryExec(t)){ flash(b,"コピー済","ok"); return; }
    if(navigator.clipboard&&navigator.clipboard.writeText){
      navigator.clipboard.writeText(t).then(function(){
        flash(b,"コピー済","ok");
      },function(){
        if(selectSource(b)) flash(b,"Cmd+C で","warn");
        else flash(b,"失敗","warn");
      });
      return;
    }
    if(selectSource(b)) flash(b,"Cmd+C で","warn");
    else flash(b,"失敗","warn");
  });

  render();
})();
</script>
`;

fs.writeFileSync(OUT, html, "utf8");
console.log(`✓ ${path.relative(ROOT, OUT)} を作成しました（${days.length}日 / ${total}枚）`);
for (const d of days) {
  console.log(`   ${d.pins.length}枚  ${d.board}${d.needsBoard ? "（要作成）" : ""}  ${d.title.slice(0, 34)}`);
}
