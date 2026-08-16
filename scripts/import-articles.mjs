// 楽天ツールが生成した比較記事(article.md)を、ブログの content/ に取り込む。
//   使い方: npm run import
// 楽天ツール側の output/articles/<slug>_<date>/article.md を走査し、
// frontmatter を付けて content/<slug>.md として書き出す（既存は上書き）。
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BLOG_ROOT = path.join(__dirname, "..");
const CONTENT_DIR = path.join(BLOG_ROOT, "content");
const ARTICLES_DIR =
  process.env.TOOL_ARTICLES_DIR ||
  path.join(BLOG_ROOT, "..", "rakuten-affiliate-tool", "output", "articles");

// slug → カード用の短いカテゴリ名（無ければ products.json の name を使う）
const CATEGORY = {
  "oral-care": "オーラルケア",
  "fabric-softener": "柔軟剤",
  "coffee-drip": "コーヒー",
  "water-filter": "浄水器",
  "diatomite-bathmat": "バスマット",
  "laundry-detergent": "洗濯洗剤",
  "dishwasher-detergent": "食洗機洗剤",
  "toothbrush-head": "替えブラシ",
  "washer-cleaner": "洗濯槽クリーナー",
  "toothpaste": "歯磨き粉",
  "water-server": "ウォーターサーバー",
  "shampoo": "シャンプー",
  "dish-soap": "食器用洗剤",
};

function fmtDate(yyyymmdd) {
  const m = String(yyyymmdd || "").match(/^(\d{4})(\d{2})(\d{2})$/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : String(yyyymmdd || "");
}

function firstParagraph(body) {
  for (const block of body.split(/\n\s*\n/)) {
    const t = block.trim();
    if (t && !t.startsWith("#") && !t.startsWith("|") && !t.startsWith("!")) {
      return t.replace(/\s+/g, " ").replace(/[*_`]/g, "").slice(0, 110);
    }
  }
  return "";
}

function main() {
  if (!fs.existsSync(ARTICLES_DIR)) {
    console.error(`記事フォルダが見つかりません: ${ARTICLES_DIR}`);
    process.exit(1);
  }
  fs.mkdirSync(CONTENT_DIR, { recursive: true });

  // slug ごとに最新日付のフォルダを採用
  const latest = {};
  for (const dir of fs.readdirSync(ARTICLES_DIR)) {
    const full = path.join(ARTICLES_DIR, dir);
    if (!fs.statSync(full).isDirectory()) continue;
    if (!fs.existsSync(path.join(full, "article.md"))) continue; // 本文未作成はスキップ
    const m = dir.match(/^(.*)_(\d{8})$/);
    const slug = m ? m[1] : dir;
    const date = m ? m[2] : "";
    if (!latest[slug] || date > latest[slug].date) latest[slug] = { full, date };
  }

  let count = 0;
  for (const [slug, { full, date }] of Object.entries(latest)) {
    const raw = fs.readFileSync(path.join(full, "article.md"), "utf8");
    const lines = raw.split("\n");
    let title = slug;
    let body = raw;
    if (lines[0] && lines[0].startsWith("# ")) {
      title = lines[0].replace(/^#\s+/, "").trim();
      body = lines.slice(1).join("\n").replace(/^\s+/, "");
    }
    // 記事内に <!-- meta-description: ... --> があればメタ説明として採用し、本文からは除去
    let description = "";
    const mdMatch = body.match(/<!--\s*meta-description:\s*([\s\S]*?)-->/i);
    if (mdMatch) {
      description = mdMatch[1].trim().replace(/\s+/g, " ");
      body = body.replace(mdMatch[0], "").replace(/^\s+/, "");
    } else {
      description = firstParagraph(body);
    }
    let category = CATEGORY[slug] || "";
    if (!category) {
      const pj = path.join(full, "products.json");
      if (fs.existsSync(pj)) {
        try {
          category = JSON.parse(fs.readFileSync(pj, "utf8")).name || "";
        } catch {}
      }
    }
    const fm =
      "---\n" +
      `title: ${JSON.stringify(title)}\n` +
      `description: ${JSON.stringify(description)}\n` +
      `category: ${JSON.stringify(category)}\n` +
      `date: ${JSON.stringify(fmtDate(date))}\n` +
      // 取り込み日を最終更新日として記録（価格・評価の鮮度を示す）
      `updated: ${JSON.stringify(new Date().toISOString().slice(0, 10))}\n` +
      "---\n\n";
    fs.writeFileSync(path.join(CONTENT_DIR, `${slug}.md`), fm + body, "utf8");
    console.log(`  ✓ ${slug}.md  (${category} / ${fmtDate(date)})`);
    count++;
  }
  console.log(`\n${count} 本の記事を content/ に取り込みました。`);
}

main();
