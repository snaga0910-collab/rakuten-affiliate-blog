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
import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { marked } from "marked";

const CONTENT_DIR = path.join(process.cwd(), "content");
const TITLE_MAX = 32; // 検索結果で切れない長さ

const errors = [];
const warns = [];

/** コードブロックは対象外（計算式を ``` で囲んでいる記事がある） */
const stripCode = (md) => md.replace(/^```[\s\S]*?^```/gm, "");
/** 表・引用・リンク記法を落として、地の文だけにする */
function proseOnly(md) {
  return stripCode(md)
    .replace(/^\|.*$/gm, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");
}

const articles = fs
  .readdirSync(CONTENT_DIR)
  .filter((f) => f.endsWith(".md"))
  .map((file) => {
    const { data, content } = matter(fs.readFileSync(path.join(CONTENT_DIR, file), "utf8"));
    return { slug: file.slice(0, -3), file, title: String(data.title ?? ""), content };
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

// タイトルの長さ。検索結果で後半が切れる。
for (const a of articles) {
  if (a.title.length > TITLE_MAX) {
    errors.push(`${a.file}  タイトルが${a.title.length}字（上限${TITLE_MAX}字）\n      ${a.title}`);
  }
}

/* ───────── 2) 全体を数える検査（警告） ───────── */

// 太字の密度。多すぎると強調が強調として働かない。
// 2026-08-27 時点の平均は 9.0回/1000字（111字に1回）だった。
const BOLD_PER_1000 = 6;
for (const a of articles) {
  const s = proseOnly(a.content);
  const n = (s.match(/\*\*.+?\*\*/g) ?? []).length;
  const d = (n / Math.max(s.length, 1)) * 1000;
  if (d > BOLD_PER_1000) {
    warns.push({ rule: "太字が多い", text: `${a.slug}  ${d.toFixed(1)}回/1000字（${n}箇所）`, n: d });
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

// 「AではなくB」の型。1つなら効くが、並ぶと機械が書いた形に見える。
const CONTRAST_PER_1000 = 1.0;
const CONTRAST = [/ではなく/g, /ではありません/g, /のではなく/g];
for (const a of articles) {
  const s = proseOnly(a.content);
  const n = CONTRAST.reduce((sum, re) => sum + (s.match(re) ?? []).length, 0);
  const d = (n / Math.max(s.length, 1)) * 1000;
  if (d > CONTRAST_PER_1000) {
    warns.push({ rule: "「AではなくB」が多い", text: `${a.slug}  ${n}回（${d.toFixed(1)}/1000字）`, n: d });
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
  process.exit(1);
}

console.log(`✓ ${articles.length}記事、止める理由はありません。`);
