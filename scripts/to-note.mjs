// ブログ記事(content/*.md)を note.com 投稿用の Markdown に変換する。
//   使い方: npm run note            … 全記事を変換
//           npm run note oral-care  … 1記事だけ変換
// 出力先: note-out/<slug>.md（Note投稿くんの publish-hybrid.js にそのまま渡せる形式）
//
// note.com 側の制約に合わせた変換をしている:
//   1. Markdownテーブルは note が非対応（投稿ツールが行ごとスキップする）ため、
//      箇条書きブロックに展開する。比較表は記事の核なので消えると価値が半減する。
//   2. [テキスト](URL) のリンク記法は note のエディタでそのまま文字列として
//      打ち込まれてしまうため、「テキスト」＋次行に生URLの形へ展開する。
//      note は生URLを自動でリンク化する。
//   3. HTMLコメント（meta-description）は削除する。
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import matter from "gray-matter";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const CONTENT_DIR = path.join(ROOT, "content");
const OUT_DIR = path.join(ROOT, "note-out");
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://rakuten-affiliate-blog.vercel.app";

// note のハッシュタグ（各記事の性格に合わせる。10個以内が扱いやすい）
const TAGS = {
  "oral-care": ["オーラルケア", "マウスウォッシュ", "デンタルフロス", "一人暮らし", "買ってよかったもの"],
  "fabric-softener": ["柔軟剤", "部屋干し", "洗濯", "一人暮らし", "暮らしの工夫"],
  "water-filter": ["浄水器", "一人暮らし", "節約", "暮らしの工夫", "買ってよかったもの"],
  "coffee-drip": ["コーヒー", "ドリップコーヒー", "在宅ワーク", "おうち時間", "節約"],
  "diatomite-bathmat": ["バスマット", "珪藻土", "一人暮らし", "暮らしの工夫", "時短家事"],
  "dishwasher-detergent": ["食洗機", "時短家事", "キッチン", "一人暮らし", "暮らしの工夫"],
  "toothbrush-head": ["電動歯ブラシ", "オーラルケア", "節約", "一人暮らし", "買ってよかったもの"],
  "laundry-detergent": ["洗濯洗剤", "部屋干し", "生乾き臭", "洗濯", "一人暮らし"],
  "washer-cleaner": ["洗濯槽クリーナー", "部屋干し", "洗濯", "一人暮らし", "暮らしの工夫"],
  "toothpaste": ["歯磨き粉", "オーラルケア", "一人暮らし", "節約", "暮らしの工夫"],
  "water-server": ["ウォーターサーバー", "宅配水", "一人暮らし", "節約", "暮らしの工夫"],
  "shampoo": ["シャンプー", "ヘアケア", "一人暮らし", "節約", "暮らしの工夫"],
  "dish-soap": ["食器用洗剤", "キッチン", "節約", "一人暮らし", "暮らしの工夫"],
  // 香水は「節約・暮らしの工夫」ではなくビューティー側のタグに寄せる。
  // note でも Pinterest でも、読者層が消耗品の節約記事とは別のため。
  "perfume": ["香水", "フレグランス", "コスメ", "美容", "買ってよかったもの"],
  "water-purifier-server": ["ウォーターサーバー", "浄水型", "一人暮らし", "固定費見直し", "暮らしの工夫"],
  "hikari-internet": ["光回線", "一人暮らし", "固定費見直し", "節約", "賃貸"],
};

/** Markdownテーブルを、note で読める箇条書きブロックに変換する。 */
function tableToList(lines) {
  const rows = lines
    .filter((l) => l.trim().startsWith("|"))
    .map((l) =>
      stripBold(l.trim())
        .replace(/^\|/, "")
        .replace(/\|$/, "")
        .split("|")
        .map((c) => c.trim())
    );
  if (rows.length < 2) return [];
  const header = rows[0];
  // 2行目が |---|---| の区切りなら本体は3行目以降
  const isSep = rows[1].every((c) => /^:?-{2,}:?$/.test(c));
  const body = rows.slice(isSep ? 2 : 1);

  // 表のセルからリンク記法を外してテキストだけにする。
  // ヘッダー行に商品名リンクが入っている表（「| | [A社](url) | [B社](url) |」の形）
  // があり、そのままだと本文に長い広告URLが残ってしまう。
  const plain = (c) => String(c).replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");

  const out = [];
  for (const row of body) {
    // 1列目は商品名（リンクを含むことが多い）
    const name = plain(row[0] || "");
    out.push(`◾️ ${name}`);
    // 2列目以降を「項目: 値」で並べる
    const details = [];
    for (let i = 1; i < row.length; i++) {
      const key = plain(header[i] || "");
      const val = plain(row[i] || "");
      if (!val || val === "―") continue;
      details.push(`${key} ${val}`);
    }
    if (details.length) out.push(details.join(" ／ "));
    // 商品ごとのURLは出さない。
    // 6商品の表だと長い生URLが6本並んで本文が読めなくなるため、
    // 購入導線は記事末尾のブログへのリンク1本に集約する。
    out.push("");
  }
  return out;
}

/** note に出してはいけない広告URLか判定する。 */
function isAdUrl(url) {
  return /(?:^|\.)a8\.net\//.test(url) || /a8\.net\//.test(url);
}

/** expandLinks が広告URLを落としたことを convert() へ伝えるためのフラグ。 */
let adFound = false;

/** 太字記法(**...**)を外して素のテキストにする。
 *
 * note の投稿ツールは太字を Ctrl+B の切り替えで入力するが、日本語だと
 * 切り替え時に直前の1文字がその場に確定されず、後続ブロックの先頭へ
 * 移動してしまう（例:「配合タイプは」→「配合タイは」＋別の場所に「プ」）。
 * note 側では太字は装飾にすぎないので、記法ごと外して確実性を取る。
 */
function stripBold(line) {
  return line.replace(/\*\*(.+?)\*\*/g, "$1");
}

/** リンク記法を「テキスト＋生URL」に展開する。
 *
 * note は「前後が空行の単独URL」だけをリンクカードに変換する。
 * 直前の行にテキストがあると変換されず、長い生URLがそのまま本文に残って
 * 誤字のように見えてしまう。そのためURLの前後に必ず空行を入れる。
 *
 * 参考文献など、本文の流れでURLを出したくない箇所は SKIP_URL_IN で落とす。
 */
function expandLinks(line) {
  const links = [...line.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g)];
  if (links.length === 0) return [line];
  let text = line;
  const urls = [];
  for (const m of links) {
    text = text.replace(m[0], m[1]);
    // A8のリンクは note に出さない。A8は掲載サイトの登録を求めており、
    // note を登録していない媒体に広告リンクを置くと規約違反になる。
    // リンク文字だけ残し、購入導線は末尾のブログへのリンクに集約する。
    if (isAdUrl(m[2])) {
      adFound = true;
      continue;
    }
    urls.push(m[2]);
  }
  // テキスト → 空行 → URL（1行1つ・間に空行）→ 空行
  const out = [text];
  for (const u of urls) out.push("", u);
  out.push("");
  return out;
}

function convert(slug) {
  const raw = fs.readFileSync(path.join(CONTENT_DIR, `${slug}.md`), "utf8");
  const { data, content } = matter(raw);
  const lines = content.split("\n");
  const out = [];
  // 広告や商品URLを落としたかどうか。落としたときは記事へのリンクで補う。
  let adRemoved = false;
  adFound = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // HTMLコメント（meta-description）は落とす
    if (/^\s*<!--/.test(line)) continue;
    // 生のHTMLブロック（A8のバナー広告など）は落とす。
    //
    // 2026-08-18: note に <div class="pa-ad">... がそのままテキストとして
    // 出力されていた。読めないうえに、A8のリンクが note に載ることになる。
    // A8は掲載サイトの登録を求めているので、登録していない媒体へ出すのは規約違反。
    // ブログ側の広告は note には持ち込まず、記事へのリンク1本に集約する。
    if (/^\s*<(?:div|p|a|img|span|iframe)[\s>]/i.test(line)) {
      adRemoved = true;
      continue;
    }
    // テーブルはまとめて箇条書きへ
    if (line.trim().startsWith("|")) {
      const block = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) block.push(lines[i++]);
      i--;
      out.push(...tableToList(block));
      continue;
    }
    // 水平線は note では不要
    if (/^\s*---\s*$/.test(line)) continue;
    // 引用記法（>）を外す。
    //
    // 2026-08-19: 記事の「>」は引用ではなく注記（計算の前提や但し書き）に使っている。
    // note では「>」が引用ブロックになり、出典の入力欄が付いてくる。
    // さらに「>」だけの空行が中身のない引用ブロックになって
    //「出典を入力」だけが残る。注記なので、記法ごと外して素のテキストにする。
    if (/^\s*>/.test(line)) {
      const inner = line.replace(/^\s*>\s?/, "");
      if (!inner.trim()) continue; // 「>」だけの行は捨てる
      out.push(...expandLinks(stripBold(inner)));
      continue;
    }

    let clean = stripBold(line);
    // 行の途中に埋め込まれたHTML（<a>広告リンク</a> や計測用の1px画像）を外す。
    // リンク文字だけ残して、URLは落とす。
    if (/<a\s|<img\s/i.test(clean)) {
      adRemoved = true;
      clean = clean
        .replace(/<a\s[^>]*>(.*?)<\/a>/gi, "$1")
        .replace(/<img\s[^>]*>/gi, "")
        .replace(/<\/?[a-z][^>]*>/gi, "");
    }
    // 参考文献など、楽天以外のURLは本文に出さない（生URLが誤字に見えるため）。
    // リンク文字だけ残し、出典名は文章として読めるようにする。
    if (/^\s*-\s*\[/.test(clean) && !clean.includes("hb.afl.rakuten")) {
      out.push(clean.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1"));
      continue;
    }
    if (clean.includes("（参考:") && !clean.includes("hb.afl.rakuten")) {
      out.push(clean.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1"));
      continue;
    }
    out.push(...expandLinks(clean));
  }

  // note用のフロントマター（Note投稿くんが読む形式）
  // TAGS への追加を忘れるとタグなしで静かに通ってしまうので、ここで気づけるようにする。
  // note のタグは流入経路そのものなので、空のまま投稿すると読まれない。
  const tags = TAGS[slug] || [];
  if (!tags.length) {
    console.warn(`  ⚠ ${slug}: TAGS に登録がありません。scripts/to-note.mjs に追加してください。`);
  }
  const fm = [
    "---",
    `title: ${data.title}`,
    "tags:",
    ...tags.map((t) => `  - ${t}`),
    "---",
    "",
  ].join("\n");

  // ステマ規制対応の表示を冒頭に入れる（note でも必須）。
  //
  // 2026-08-18: 「楽天アフィリエイト」「楽天市場のデータ」を全記事に固定で
  // 入れていたが、光回線や浄水型サーバーのように楽天のリンクもデータも
  // 使っていない記事がある。表示が事実と違うと、規制対応として意味をなさない。
  // 本文に楽天のリンクがあるかどうかで文面を切り替える。
  // 本文に楽天のリンクが残っているかで文面を切り替える。
  // A8の広告は上で落としているので、A8だけの記事には広告リンクが残らない。
  let body = out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  const hasRakutenLink = body.includes("hb.afl.rakuten");

  // 商品ごとのURLを落としたぶん、記事へのリンクを1本だけ末尾に置く。
  // note の読者をブログへ送る導線でもある（購入リンクはブログ側にある）。
  if (adRemoved || adFound || !hasRakutenLink) {
    body +=
      "\n\n――――――\n\n" +
      "各社へのリンクと、全項目をそろえた比較表はブログにまとめています。\n\n" +
      `${SITE_URL}/articles/${slug}\n`;
  }

  const disclosure = hasRakutenLink
    ? "※本記事はアフィリエイト広告（楽天アフィリエイト）を利用しています。\n" +
      "※価格・評価は執筆時点の楽天市場のデータです。\n"
    : "※この記事にはアフィリエイト広告を含むページへのリンクがあります。\n" +
      "※料金・条件は執筆時点で各社が公表している情報です。\n";
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const outPath = path.join(OUT_DIR, `${slug}.md`);
  fs.writeFileSync(outPath, `${fm}${disclosure}\n${body}\n`, "utf8");
  return { outPath, chars: body.length, tags };
}

const target = process.argv[2];
const slugs = target
  ? [target]
  : fs.readdirSync(CONTENT_DIR).filter((f) => f.endsWith(".md")).map((f) => f.replace(/\.md$/, ""));

for (const slug of slugs) {
  const { outPath, chars, tags } = convert(slug);
  console.log(`  ✓ ${path.relative(ROOT, outPath)}  (${chars.toLocaleString()}字 / タグ: ${tags.join("・")})`);
}
console.log(`\n${slugs.length} 本を note 用に変換しました。`);
console.log("投稿手順は NOTE.md を参照してください。");
