// 楽天ツールが保存した商品データ（products.json）を、ブログ用にまとめ直す。
//   使い方: npm run products
// 出力先: data/products.json（比較表に商品画像・評価・レビュー件数を出すために使う）
//
// これまで手作業で足していたため、記事を追加したときに反映漏れが起きていた。
// 記事の取り込み（npm run import）と同じ元データから作り直す。
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BLOG_ROOT = path.join(__dirname, "..");
const ARTICLES_DIR =
  process.env.TOOL_ARTICLES_DIR ||
  path.join(BLOG_ROOT, "..", "rakuten-affiliate-tool", "output", "articles");
const OUT = path.join(BLOG_ROOT, "data", "products.json");

/** 楽天APIのサムネイルURLは末尾に ?_ex=128x128 が付く。原寸を使うため落とす。 */
function fullImage(urls) {
  const first = Array.isArray(urls) ? urls[0] : undefined;
  return first ? String(first).replace(/\?_ex=\d+x\d+$/, "") : "";
}

if (!fs.existsSync(ARTICLES_DIR)) {
  console.error(`記事フォルダが見つかりません: ${ARTICLES_DIR}`);
  process.exit(1);
}

// slug ごとに最新日付のフォルダを採用（import-articles.mjs と同じ規則）
const latest = {};
for (const dir of fs.readdirSync(ARTICLES_DIR)) {
  const full = path.join(ARTICLES_DIR, dir);
  if (!fs.statSync(full).isDirectory()) continue;
  if (!fs.existsSync(path.join(full, "article.md"))) continue; // 本文未作成はスキップ
  if (!fs.existsSync(path.join(full, "products.json"))) continue;
  const m = dir.match(/^(.*)_(\d{8})$/);
  const slug = m ? m[1] : dir;
  const date = m ? m[2] : "";
  if (!latest[slug] || date > latest[slug].date) latest[slug] = { full, date };
}

const out = {};
for (const [slug, { full }] of Object.entries(latest)) {
  const raw = JSON.parse(fs.readFileSync(path.join(full, "products.json"), "utf8"));
  const items = Array.isArray(raw) ? raw : raw.products || [];
  out[slug] = items.map((p) => ({
    name: p.itemName,
    price: p.itemPrice,
    review: p.reviewCount ?? 0,
    rating: p.reviewAverage ?? 0,
    url: p.affiliateUrl,
    image: fullImage(p.mediumImageUrls),
    shop: p.shopName ?? "",
  }));
  console.log(`  ✓ ${slug}  (${out[slug].length}商品)`);
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, `${JSON.stringify(out, null, 1)}\n`, "utf8");
console.log(`\n${Object.keys(out).length} ジャンル分を data/products.json に書き出しました。`);
