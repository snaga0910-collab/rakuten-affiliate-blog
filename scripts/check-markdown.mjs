// 記事を機械的に検査する。
//   使い方: npm run check
//   ビルド前に必ず走る（package.json の build で連結している）。
//
// 検査は2本立てにしてある。
//
//   1) 言葉を探す検査 … 1文を見れば判定できるもの。落ちたらビルドを止める。
//   2) 全体を数える検査 … 1文では分からないもの。割合を出して警告する。
//
// 分けている理由は、読んだ人が「AIっぽい」と感じるのは後者が多いため。
// アスタリスクの露出は1文で分かるが、「20本とも同じ見出し」「6文に1回が
// 同じ語尾」は、記事をまたいで数えないと見えない。
//
// ルールは、実際に受けた指摘をそのまま足していく方針にする。
// 同じ指摘を2回もらわないことが目的で、AI感をゼロにするのが目的ではない。
// 判定は機械にやらせる。読み返して気をつける、では会話が長くなるほど薄まる。
//
// 2026-08-31: 添削の「統一採点基準」を受け取ったので、そこで数値が示されて
// いる項目をここに移した。数値がある指摘は、人が読み返す前に機械で落とせる。
// 各ルールのコメントに、基準のどの節かを（§n）で書いてある。
import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { marked } from "marked";

const CONTENT_DIR = path.join(process.cwd(), "content");

const TITLE_MAX = 32; // §8 検索結果で切れない長さ
const SENT_STOP = 100; // §3 101字以上は原則分割
const SENT_WARN = 80; // §3 81〜100字は「×」帯
const PARA_WARN = 200; // §4 200字超は分割候補
const KW_LOW = 0.5; // §10 0〜0.5%は不足の可能性大
const KW_HIGH = 4.0; // §10 4%以上は過剰の可能性大

const errors = [];
const warns = [];

/** コードブロックは対象外（計算式を ``` で囲んでいる記事がある） */
const stripCode = (md) => md.replace(/^```[\s\S]*?^```/gm, "");
/** HTMLのタグを外す（A8の広告タグ）。URLは読者が読む文字ではないので、
 *  文の長さに数えると1文250字のような数字になってしまう。表示される文字だけ残す */
const stripHtml = (md) => md.replace(/<[^>]+>/g, "");
/** 表・引用・リンク記法を落として、地の文だけにする */
function proseOnly(md) {
  return stripHtml(stripCode(md))
    .replace(/^\|.*$/gm, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");
}
/** 読者が地の文として読む部分。引用の「>」は外し、中身は数える */
function readable(md) {
  return proseOnly(md)
    .replace(/^\s*>\s?/gm, "")
    .replace(/^#+\s.*$/gm, "");
}
/** キーワード比率の分母。表の商品名も読者は読むので残す */
function fullBody(md) {
  return stripHtml(stripCode(md))
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\*/g, "");
}
/** 文に割る。「。」のほか、!? と行末でも切れるものとして扱う */
function sentences(text) {
  return text
    .replace(/\*/g, "")
    .split("\n")
    .flatMap((line) => line.split(/(?<=[。！？])/))
    .map((s) => s.trim().replace(/^[-*\d.]+\s*/, ""))
    .filter((s) => s.length >= 6);
}

/** 太字を数えるとき、装飾ではなく構造として使っている箇所は除く。
 *  - 「**Q. …**」   … FAQの見出し。marked に見出しとして渡す代わりの記法
 *  - 「- **語**：…」 … 箇条書きのラベル。定義リストの代わり
 *  これらを数に入れると、FAQと箇条書きが多い記事ほど密度が上がってしまい、
 *  「強調しすぎ」という本来見たい指標からずれる。 */
function decorativeBold(md) {
  return proseOnly(md)
    .replace(/^\s*\*\*Q\..*?\*\*/gm, "")
    .replace(/^\s*[-*]\s+\*\*[^*]+\*\*/gm, "");
}

const articles = fs
  .readdirSync(CONTENT_DIR)
  .filter((f) => f.endsWith(".md"))
  .map((file) => {
    const { data, content } = matter(fs.readFileSync(path.join(CONTENT_DIR, file), "utf8"));
    return {
      slug: file.slice(0, -3),
      file,
      title: String(data.title ?? ""),
      keyword: data.keyword ? String(data.keyword) : "",
      // 本文では言い換えのほうが自然に出る語（「食材宅配」に対する「宅配」など）。
      // 比率は主軸と言い換えの合算で見る。基準も「比率より自然さを優先」としている。
      keywordAlt: Array.isArray(data.keywordAlt) ? data.keywordAlt.map(String) : [],
      content,
    };
  });

/* ───────── 1) 言葉を探す検査（落ちたら止める） ───────── */

// アスタリスクの露出。
// CommonMark では閉じる ** の直前が記号だと太字にならない。日本語では
// 「）**の」「%**で」「」**が」が自然に出るので、規則を覚えるより出力を見る。
for (const a of articles) {
  let line = 1;
  for (const block of stripCode(a.content).split(/\n\s*\n/)) {
    if (marked.parse(block).includes("**")) {
      const first = block.split("\n").find((l) => l.includes("**")) ?? block;
      errors.push(`${a.file}:${line}  アスタリスクが露出します\n      ${first.trim().slice(0, 76)}`);
    }
    line += block.split("\n").length + 1;
  }
}

// §8 タイトルの長さ。検索結果で後半が切れる。
for (const a of articles) {
  if (a.title.length > TITLE_MAX) {
    errors.push(`${a.file}  タイトルが${a.title.length}字（上限${TITLE_MAX}字）\n      ${a.title}`);
  }
}

// §9 主軸キーワードは、タイトルに完全一致で入れる。
// 「一人暮らし 水代」が主軸なのに「飲み水にかかる費用は？」では弱くなる。
// front matter に keyword が無い記事は、そもそも狙いが決まっていない。
for (const a of articles) {
  if (!a.keyword) {
    errors.push(`${a.file}  主軸キーワード（front matter の keyword）が未設定です`);
  } else if (!a.title.includes(a.keyword)) {
    errors.push(`${a.file}  タイトルに主軸キーワード「${a.keyword}」がありません\n      ${a.title}`);
  }
}

// §3 一文101字以上は原則分割。
// 「長いけれど意味がある」文と「情報を詰め込みすぎた」文は別物だが、
// 100字を超えたものは実際に見ると後者だった。分けるか、表に逃がす。
for (const a of articles) {
  for (const s of sentences(readable(a.content))) {
    if (s.length > SENT_STOP) {
      errors.push(`${a.file}  一文が${s.length}字（上限${SENT_STOP}字）\n      ${s.slice(0, 72)}…`);
    }
  }
}

// §17 「最安」の断定は、調べた範囲を書く。
// 市場全体を調べていないのに「最も安い」と書くのは、根拠のない断定になる。
// 「今回調査した6商品では最安」なら問題ない。
//
// 範囲を探す窓は H2 の節にする。段落だけを見ると
// 「6商品を並べて1回あたりに直したら」が前の段落にある記事を落としてしまう。
// 疑問文（FAQの見出し）と否定文（「最安とは言えません」）は主張ではないので数えない。
const SUPERLATIVE = /(最安|最も安い|いちばん安い|一番安い|No\.?1|ナンバーワン|一番おすすめ|最もおすすめ|最強)/;
const SCOPED = /(今回|本記事|この記事|調査|調べた|比較した|比べた|対象|範囲|\d+\s*(商品|社|サービス|通り|つ)|各社|ここでは|一覧|表)/;
const NOT_A_CLAIM = /(？|\?|ですか|でしょうか|言えません|とは限りません|ではありません|ありません|より|だけで)/;
for (const a of articles) {
  // 「## 見出し」で節に割る。冒頭は最初の見出しまでを1節として扱う。
  for (const raw of a.content.split(/^(?=##\s)/m)) {
    const section = readable(raw);
    if (SCOPED.test(section)) continue;
    for (const s of sentences(section)) {
      if (!SUPERLATIVE.test(s) || NOT_A_CLAIM.test(s)) continue;
      errors.push(`${a.file}  「最安」の範囲が書かれていません（§17）\n      ${s.slice(0, 72)}`);
    }
  }
}

/* ───────── 2) 全体を数える検査（警告） ───────── */

// 太字の密度。多すぎると強調が強調として働かない。
// 2026-08-27 時点の平均は 9.0回/1000字（111字に1回）だった。
const BOLD_PER_1000 = 6;
for (const a of articles) {
  const s = decorativeBold(a.content);
  const n = (s.match(/\*\*.+?\*\*/g) ?? []).length;
  const d = (n / Math.max(s.length, 1)) * 1000;
  if (d > BOLD_PER_1000) {
    warns.push({ rule: "太字が多い", text: `${a.slug}  ${d.toFixed(1)}回/1000字（${n}箇所）`, n: d });
  }
}

// §3 81〜100字の文。基準では「×」の帯。1本や2本なら読めるが、
// 増えると一文の情報量が多い記事になる。全体の1割を超えたら見直す。
const LONG_SHARE = 0.1;
for (const a of articles) {
  const ss = sentences(readable(a.content));
  if (ss.length < 20) continue;
  const long = ss.filter((s) => s.length > SENT_WARN);
  if (long.length / ss.length > LONG_SHARE) {
    warns.push({
      rule: `一文が長い（${SENT_WARN}字超）`,
      text: `${a.slug}  ${long.length}/${ss.length}文（${((long.length / ss.length) * 100).toFixed(0)}%）`,
      n: long.length / ss.length,
    });
  }
}

// §4 段落200字超は分割候補。スマホだと文字の壁になる。
for (const a of articles) {
  const paras = stripHtml(stripCode(a.content))
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p && !/^[|>#]|^\s*[-*]\s/.test(p))
    .map((p) => ({ len: p.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/\*/g, "").length, p }));
  for (const { len, p } of paras) {
    if (len > PARA_WARN) {
      warns.push({ rule: "段落が長い（200字超）", text: `${a.slug}  ${len}字  ${p.slice(0, 40)}…`, n: len });
    }
  }
}

// §10 主軸キーワードの比率。0.5%未満は不足、4%以上は過剰。
// ただし基準にあるとおり「比率より自然さを優先」なので、警告どまりにする。
// 数えるのは主軸＋言い換え。長い語から数えて、二重に数えない。
for (const a of articles) {
  if (!a.keyword) continue;
  const body = fullBody(a.content);
  let rest = body;
  let chars = 0;
  const detail = [];
  for (const k of [a.keyword, ...a.keywordAlt].sort((x, y) => y.length - x.length)) {
    const n = (rest.match(new RegExp(k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) ?? []).length;
    chars += n * k.length;
    detail.push(`${k}:${n}`);
    rest = rest.split(k).join("");
  }
  const pct = (chars / Math.max(body.length, 1)) * 100;
  if (pct < KW_LOW || pct > KW_HIGH) {
    warns.push({
      rule: "主軸キーワードの比率",
      text: `${a.slug}  ${pct.toFixed(2)}%（${pct < KW_LOW ? "不足" : "過剰"}）  ${detail.join(" ")}`,
      n: pct < KW_LOW ? KW_LOW - pct : pct - KW_HIGH,
    });
  }
}

// §21 見出しのキーワード。H2に主軸が1つも入らない記事は、
// 検索エンジンから見て何の記事か分かりにくい。
for (const a of articles) {
  if (!a.keyword) continue;
  const h2 = a.content.match(/^## .+$/gm) ?? [];
  if (h2.length && !h2.some((h) => h.includes(a.keyword) || a.keywordAlt.some((k) => h.includes(k)))) {
    warns.push({ rule: "H2に主軸キーワードがない", text: `${a.slug}  「${a.keyword}」がH2${h2.length}本のどれにもありません` });
  }
}

// 文末の偏り。同じ終わり方が続くと、意味ではなくリズムでAIっぽくなる。
const ENDING_MAX = 0.15;
for (const a of articles) {
  const counts = new Map();
  let total = 0;
  for (const sent of proseOnly(a.content).match(/[^。\n]+。/g) ?? []) {
    const t = sent.trim().replace(/\*/g, "");
    if (t.length < 6) continue;
    total++;
    const k = t.slice(-4);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  if (total < 20) continue;
  const [k, v] = [...counts].sort((x, y) => y[1] - x[1])[0] ?? [];
  if (v / total > ENDING_MAX) {
    warns.push({ rule: "文末が偏る", text: `${a.slug}  「…${k}」${((v / total) * 100).toFixed(1)}%（${v}/${total}文）`, n: v / total });
  }
}

// §19 AIっぽい型。1回出ただけでは判定しない。同じ型が繰り返されるのが問題。
const AI_TAILS = [
  /と言えるでしょう/g,
  /かもしれません/g,
  /ではないでしょうか/g,
  /非常に重要です/g,
  /することが大切です/g,
  /いかがでしたでしょうか/g,
  /ぜひ[^。]{0,14}してみましょう/g,
];
const AI_MAX = 3;
for (const a of articles) {
  const s = readable(a.content);
  const hits = AI_TAILS.map((re) => (s.match(re) ?? []).length);
  const n = hits.reduce((x, y) => x + y, 0);
  if (n >= AI_MAX) {
    warns.push({ rule: "AIっぽい型の繰り返し", text: `${a.slug}  ${n}回`, n });
  }
}

// §6 抽象表現。「便利です」「おすすめです」「重要です」だけでは何も言っていない。
// 数字か、誰に向くかに置き換える。
const VAGUE = [/便利です/g, /おすすめです/g, /重要です/g, /大切です/g, /と言えます/g, /ポイントです/g];
const VAGUE_MAX = 3;
for (const a of articles) {
  const s = readable(a.content);
  const n = VAGUE.reduce((sum, re) => sum + (s.match(re) ?? []).length, 0);
  if (n >= VAGUE_MAX) {
    warns.push({ rule: "抽象表現が多い", text: `${a.slug}  ${n}回`, n });
  }
}

// 技術チェック③ 文体の統一。です・ます調の記事に、である調が混ざる。
// 「〜ではない。」は言い切りのリズムとして使っているので数えない。
const DEARU = [/である。/g, /であった。/g, /だろう。/g, /のだ。/g, /していた。/g];
for (const a of articles) {
  const s = readable(a.content);
  const n = DEARU.reduce((sum, re) => sum + (s.match(re) ?? []).length, 0);
  if (n > 0) warns.push({ rule: "文体が混ざる（である調）", text: `${a.slug}  ${n}箇所`, n });
}

// 技術チェック④ 表記の揺れ。同じ記事の中で両方の書き方が出たときだけ言う。
const VARIANTS = [
  ["か月", "ヶ月", "ヵ月", "カ月"],
  ["できる", "出来る"],
  ["ください", "下さい"],
  ["ウォーターサーバー", "ウォーターサーバ "],
  ["1回あたり", "1回当たり"],
];
for (const a of articles) {
  const s = fullBody(a.content);
  for (const group of VARIANTS) {
    const found = group.filter((v) => s.includes(v));
    if (found.length > 1) {
      warns.push({ rule: "表記が揺れる", text: `${a.slug}  ${found.join(" / ")}` });
    }
  }
}

// §14 桁区切り。4桁以上の金額はカンマを入れる。表と本文で揃っていないと、
// 同じ金額が別の数字に見える。
for (const a of articles) {
  for (const m of fullBody(a.content).matchAll(/(?<![\d,.])(\d{4,})\s*円/g)) {
    warns.push({ rule: "金額の桁区切り", text: `${a.slug}  ${m[1]}円 → ${Number(m[1]).toLocaleString()}円`, n: 1 });
  }
}

// 見出しの使い回し。全記事に同じ節があると、誠実さの印ではなく型の印になる。
const HEADING_SHARE = 0.8;
const headings = new Map();
for (const a of articles) {
  for (const h of new Set(a.content.match(/^## .+$/gm) ?? [])) {
    headings.set(h, (headings.get(h) ?? 0) + 1);
  }
}
for (const [h, n] of [...headings].sort((x, y) => y[1] - x[1])) {
  if (n / articles.length >= HEADING_SHARE) {
    warns.push({ rule: "見出しの使い回し", text: `「${h.replace(/^##\s*/, "")}」が ${n}/${articles.length}記事`, n });
  }
}

// タイトルが言う数より、比較表の行が少ないとき。
// 多いぶんは、プラン別・解約時期別の表を拾っているだけのことが多いので見ない
// （4社の記事に5行、3社の記事に6行、いずれも正しかった）。
// なお行数が合っていても中身が合っているとは限らない。「マウスウォッシュ6商品」と
// 書いて洗口液3＋フロス3を並べていたときは、行数は6で合っていた。
for (const a of articles) {
  const m = a.title.match(/(\d+)\s*(商品|社|サービス|選)/);
  if (!m) continue;
  const tables = [...a.content.matchAll(/\n(\|[^\n]*\|\n\|[\s:|-]+\|\n(?:\|[^\n]*\|\n)+)/g)].map((x) => x[1]);
  if (!tables.length) continue;
  const rows = Math.max(...tables.map((t) => t.trim().split("\n").length - 2));
  if (rows < Number(m[1])) {
    warns.push({ rule: "表の行数", text: `${a.slug}  タイトルは${m[1]}${m[2]}、比較表は${rows}行しかありません` });
  }
}

// §15 単価の割り算。「価格 ÷ 個数 = 1個あたり」が並んでいる表の行を検算する。
// 単価は記事の結論に直結するので、1行ずれると結論ごと間違える。
const NUM = (t) => Number(String(t).replace(/,/g, ""));
for (const a of articles) {
  for (const row of a.content.match(/^\|.*\|$/gm) ?? []) {
    const cells = row.split("|").slice(1, -1).map((c) => c.replace(/\*/g, "").trim());
    // 「◯円」「◯本」「◯円」の順に並ぶ3セルを探す
    for (let i = 0; i + 2 < cells.length; i++) {
      const price = cells[i].match(/^([\d,]+)\s*円$/);
      const count = cells[i + 1].match(/^([\d,]+)\s*(本|個|回|枚|包|袋|杯|食)$/);
      const unit = cells[i + 2].match(/^約?([\d,.]+)\s*円$/);
      if (!price || !count || !unit) continue;
      const expect = NUM(price[1]) / NUM(count[1]);
      const got = NUM(unit[1]);
      // 小数第1位まで書く記事と整数に丸める記事があるので、丸め1つ分は許す
      if (Math.abs(expect - got) > Math.max(0.55, expect * 0.02)) {
        warns.push({
          rule: "単価の割り算が合わない",
          text: `${a.slug}  ${price[1]}円÷${count[1]}${count[2]}=${expect.toFixed(1)}円 だが「${unit[1]}円」と記載`,
          n: Math.abs(expect - got),
        });
      }
    }
  }
}

// 「月◯円 → 年◯円」「◯円×12」の掛け算が合っているか。
//
// 2026-08-29: 動画配信の記事で「月3,332円 → 年39,984円」と書いていた。
// 3,332は端数を丸めた月額で、実際の支払い（年払い5,900円＋月額×12）は39,980円。
// 丸めた数字を12倍すると、実在しない金額になる。
const YEN = (t) => Number(t.replace(/,/g, ""));
for (const a of articles) {
  const src = a.content;
  for (const m of src.matchAll(/月\s*([\d,]+)\s*円\s*(?:→|＝|=)\s*年\s*([\d,]+)\s*円/g)) {
    const [mo, yr] = [YEN(m[1]), YEN(m[2])];
    if (Math.abs(mo * 12 - yr) > 12) {
      warns.push({
        rule: "月額×12と年額が合わない",
        text: `${a.slug}  月${m[1]}円×12=${(mo * 12).toLocaleString()}円 だが「年${m[2]}円」と記載`,
        n: Math.abs(mo * 12 - yr),
      });
    }
  }
  for (const m of src.matchAll(/([\d,]+)\s*円\s*[×x]\s*12\s*(?:＝|=|は)?\s*([\d,]+)\s*円/g)) {
    const [unit, total] = [YEN(m[1]), YEN(m[2])];
    if (Math.abs(unit * 12 - total) > 12) {
      warns.push({
        rule: "月額×12と年額が合わない",
        text: `${a.slug}  ${m[1]}円×12=${(unit * 12).toLocaleString()}円 だが「${m[2]}円」と記載`,
        n: Math.abs(unit * 12 - total),
      });
    }
  }
}

/* ───────── 出力 ───────── */

if (warns.length) {
  // ルールごとにまとめ、悪い順に3件だけ出す。
  // 全部並べると40行を超えて、読まれなくなる。
  const byRule = new Map();
  for (const w of warns) {
    if (!byRule.has(w.rule)) byRule.set(w.rule, []);
    byRule.get(w.rule).push(w);
  }
  console.log(`△ 数えた結果（ビルドは通ります）\n`);
  for (const [rule, list] of byRule) {
    list.sort((a, b) => (b.n ?? 0) - (a.n ?? 0));
    console.log(`  ${rule}  ${list.length}件`);
    for (const w of list.slice(0, 3)) console.log(`    ${w.text}`);
    if (list.length > 3) console.log(`    ほか${list.length - 3}件`);
    console.log("");
  }
}

if (errors.length) {
  console.log(`✗ ${errors.length}件、直してください`);
  for (const e of errors) console.log(`  ${e}`);
  console.log("");
  console.log("  アスタリスク: **[語](url)** → [**語**](url) ／ **「語」** → 「**語**」");
  console.log("               閉じる ** の直前が記号のときは太字にできません");
  console.log("  最安の断定  : 「今回調査した6商品では最安」のように範囲を同じ段落に書く");
  process.exit(1);
}

console.log(`✓ ${articles.length}記事、止める理由はありません。`);
