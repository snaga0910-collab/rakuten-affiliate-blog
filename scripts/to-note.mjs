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

// note のハッシュタグ（各記事の性格に合わせる。10個以内が扱いやすい）
const TAGS = {
  "oral-care": ["オーラルケア", "マウスウォッシュ", "デンタルフロス", "一人暮らし", "買ってよかったもの"],
  "fabric-softener": ["柔軟剤", "部屋干し", "洗濯", "一人暮らし", "暮らしの工夫"],
  "water-filter": ["浄水器", "一人暮らし", "節約", "暮らしの工夫", "買ってよかったもの"],
  "coffee-drip": ["コーヒー", "ドリップコーヒー", "在宅ワーク", "おうち時間", "節約"],
  "diatomite-bathmat": ["バスマット", "珪藻土", "一人暮らし", "暮らしの工夫", "時短家事"],
};

/** Markdownテーブルを、note で読める箇条書きブロックに変換する。 */
function tableToList(lines) {
  const rows = lines
    .filter((l) => l.trim().startsWith("|"))
    .map((l) =>
      l.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim())
    );
  if (rows.length < 2) return [];
  const header = rows[0];
  // 2行目が |---|---| の区切りなら本体は3行目以降
  const isSep = rows[1].every((c) => /^:?-{2,}:?$/.test(c));
  const body = rows.slice(isSep ? 2 : 1);

  const out = [];
  for (const row of body) {
    // 1列目は商品名（リンクを含むことが多い）
    const nameCell = row[0] || "";
    const link = nameCell.match(/\[([^\]]+)\]\(([^)]+)\)/);
    const name = link ? link[1] : nameCell;
    out.push(`◾️ ${name}`);
    // 2列目以降を「項目: 値」で並べる
    const details = [];
    for (let i = 1; i < row.length; i++) {
      const key = header[i] || "";
      const val = row[i] || "";
      if (!val || val === "―") continue;
      details.push(`${key} ${val}`);
    }
    if (details.length) out.push(details.join(" ／ "));
    if (link) out.push(link[2]); // 生URL（noteが自動リンク化）
    out.push("");
  }
  return out;
}

/** リンク記法を「テキスト＋生URL」に展開する。 */
function expandLinks(line) {
  const links = [...line.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g)];
  if (links.length === 0) return [line];
  let text = line;
  const urls = [];
  for (const m of links) {
    text = text.replace(m[0], m[1]);
    urls.push(m[2]);
  }
  return [text, ...urls];
}

function convert(slug) {
  const raw = fs.readFileSync(path.join(CONTENT_DIR, `${slug}.md`), "utf8");
  const { data, content } = matter(raw);
  const lines = content.split("\n");
  const out = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // HTMLコメント（meta-description）は落とす
    if (/^\s*<!--/.test(line)) continue;
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
    out.push(...expandLinks(line));
  }

  // note用のフロントマター（Note投稿くんが読む形式）
  const tags = TAGS[slug] || [];
  const fm = [
    "---",
    `title: ${data.title}`,
    "tags:",
    ...tags.map((t) => `  - ${t}`),
    "---",
    "",
  ].join("\n");

  // ステマ規制対応の表示を冒頭に入れる（note でも必須）
  const disclosure =
    "※本記事はアフィリエイト広告（楽天アフィリエイト）を利用しています。\n" +
    "※価格・評価は執筆時点の楽天市場のデータです。\n";

  const body = out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
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
