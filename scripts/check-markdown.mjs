// 記事を実際のレンダラ(marked)に通し、出力HTMLに ** がそのまま出る箇所を検出する。
//   使い方: npm run check
//
// 2026-08-26: 公開ページに「詳しくは**部屋干し洗濯洗剤5商品の比較**」のように
// アスタリスクが露出していた。CommonMark では、閉じる ** の直前が記号のとき、
// また開く ** の直前が文字で直後が記号のときは、太字として解釈されない。
// 日本語だと「は**[」「）**の」「%**で」のような並びが自然に出るため、
// 規則を覚えて避けるより、出力を見て落とすほうが確実。
import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { marked } from "marked";

const CONTENT_DIR = path.join(process.cwd(), "content");

/** コードブロックの中身は対象外（計算式を ``` で囲んでいる記事がある） */
function stripCode(md) {
  return md.replace(/^```[\s\S]*?^```/gm, "");
}

let bad = 0;
for (const file of fs.readdirSync(CONTENT_DIR).filter((f) => f.endsWith(".md"))) {
  const { content } = matter(fs.readFileSync(path.join(CONTENT_DIR, file), "utf8"));
  const src = stripCode(content);
  // 段落ごとに見る。行をまたぐ太字を誤検出しないため、空行で区切る。
  let line = 1;
  for (const block of src.split(/\n\s*\n/)) {
    const html = marked.parse(block);
    if (html.includes("**")) {
      bad++;
      const first = block.split("\n").find((l) => l.includes("**")) ?? block;
      console.log(`  ${file}:${line}  ${first.trim().slice(0, 90)}`);
    }
    line += block.split("\n").length + 1;
  }
}

if (bad) {
  console.log(`\n✗ ${bad} 箇所でアスタリスクが露出します。`);
  console.log(`  直し方: **[語](url)** → [**語**](url) ／ **「語」** → 「**語**」`);
  console.log(`         **…%**で → **…%です** のように、閉じる ** の前を文字にする`);
  process.exit(1);
}
console.log("✓ アスタリスクの露出はありません。");
