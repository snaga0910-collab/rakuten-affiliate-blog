// ピン投稿時に貼り付けるタイトル・説明文・リンクの一覧を作る。
//   使い方: npm run pintext
// 出力先: pins/POST.md （そのまま見ながら投稿できる形）
//
// Pinterestは検索エンジンなので、説明文にキーワードを自然に含めることが効く。
// 煽らず、選ぶ手助けになる書き方に統一する。
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import matter from "gray-matter";
import { PIN_COPY } from "./pin-copy.mjs";
import { costTable } from "./pin-table-data.mjs";
import { SITE_NAME } from "./thumbnail-style.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const CONTENT_DIR = path.join(ROOT, "content");
const OUT = path.join(ROOT, "pins", "POST.md");

// 記事ごとの検索キーワード（説明文とボード選びに使う）
const KEYWORDS = {
  "oral-care": ["マウスウォッシュ", "洗口液", "デンタルフロス", "口臭対策", "オーラルケア"],
  "fabric-softener": ["柔軟剤", "部屋干し", "生乾き臭", "洗濯", "一人暮らし"],
  "coffee-drip": ["ドリップコーヒー", "おうちカフェ", "在宅ワーク", "コーヒー", "節約"],
  "water-filter": ["浄水器", "カートリッジ", "ブリタ", "クリンスイ", "一人暮らし"],
  "diatomite-bathmat": ["バスマット", "珪藻土", "速乾", "お風呂", "一人暮らし"],
  "laundry-detergent": ["洗濯洗剤", "部屋干し", "生乾き臭", "洗濯", "一人暮らし"],
  "dishwasher-detergent": ["食洗機", "食洗機用洗剤", "時短家事", "キッチン", "一人暮らし"],
  "toothbrush-head": ["電動歯ブラシ", "替えブラシ", "オーラルB", "ソニッケアー", "オーラルケア"],
  "washer-cleaner": ["洗濯槽クリーナー", "洗濯槽", "部屋干し", "生乾き臭", "一人暮らし"],
  "toothpaste": ["歯磨き粉", "ハミガキ", "オーラルケア", "フッ素", "一人暮らし"],
  "dish-soap": ["食器用洗剤", "キッチン", "詰め替え", "節約", "一人暮らし"],
};

const BOARD = {
  "oral-care": "オーラルケアの選び方",
  "fabric-softener": "一人暮らしの洗濯・柔軟剤えらび",
  "coffee-drip": "おうちコーヒー",
  "water-filter": "浄水器・水まわり",
  "diatomite-bathmat": "バスマット・お風呂まわり",
  "laundry-detergent": "一人暮らしの洗濯・柔軟剤えらび",
  "dishwasher-detergent": "キッチンの時短",
  "toothbrush-head": "オーラルケアの選び方",
  "washer-cleaner": "一人暮らしの洗濯・柔軟剤えらび",
  "toothpaste": "オーラルケアの選び方",
  "dish-soap": "キッチンの時短",
};

const VARIANT_LABEL = { table: "コスト一覧", price: "価格訴求", compare: "比較訴求" };

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://rakuten-affiliate-blog.vercel.app";

/** コスト一覧ピンの文言。数字は比較表そのものなので、記事を直せば自動で追従する。 */
function tableText(slug) {
  const copy = PIN_COPY[slug];
  const t = copy.table ?? costTable(copy.article ?? slug);
  if (!t) return null;
  const rows = t.rows.slice(0, 6);
  const kw = (copy.keywords ?? KEYWORDS[slug] ?? []).map((k) => `#${k}`).join(" ");
  const list = rows.map((r) => `${r.full} ${r.cost}`).join("／");
  // ハッシュタグは検索に効くので必ず残し、あふれるときは商品リスト側を削る
  const head = `${t.subject}を${/価格|コスト$/.test(t.label) ? t.label : t.label + "コスト"}の安い順に並べました。`;
  const tail = "。実際の価格とレビューをもとに比較しています。";
  const room = 200 - head.length - tail.length - kw.length - 1;
  const body = list.length > room ? list.slice(0, Math.max(0, room - 1)) + "…" : list;
  const desc = `${head}${body}${tail}${kw}`;
  return {
    title: `${t.subject} ${rows.length}件の${/価格|コスト$/.test(t.label) ? t.label : t.label + "コスト"}一覧`,
    desc,
  };
}

function description(slug, variant, copy, count) {
  const v = copy[variant];
  const kw = PIN_COPY[slug]?.keywords ?? KEYWORDS[slug] ?? [];
  const body = `${v.lead}。${v.points.join("。")}。`;
  const tags = kw.map((k) => `#${k}`).join(" ");
  // 説明文は200字以内が扱いやすい
  // 記事に紐づかないトピック（article を持つもの）は「◯商品」と言えないので締めを変える
  const tail = PIN_COPY[slug]?.article
    ? " 記事では年間コストの計算根拠も書いています。"
    : ` 実際の価格とレビューをもとに${count}商品を比較しました。`;
  let text = `${v.head.replace(/\n/g, "")}｜${body}${tail}${tags}`;
  if (text.length > 200) text = text.slice(0, 197) + "…";
  return text;
}

const slugs = Object.keys(PIN_COPY).filter((s) =>
  fs.existsSync(path.join(CONTENT_DIR, `${PIN_COPY[s].article ?? s}.md`))
);

const lines = [
  `# Pinterest 投稿シート（${SITE_NAME}）`,
  "",
  "各ピンの「タイトル」「説明文」「リンク先」をそのままコピーして投稿してください。",
  "1日2〜3枚ずつに分けるのがおすすめです（一度に大量投稿するとスパム判定のリスク）。",
  "",
  "投稿したら「済」にチェックを入れて進捗を管理できます。",
  "",
];

for (const slug of slugs) {
  const copy = PIN_COPY[slug];
  const articleSlug = copy.article ?? slug;
  const { data } = matter(fs.readFileSync(path.join(CONTENT_DIR, `${articleSlug}.md`), "utf8"));
  const url = `${SITE_URL}/articles/${articleSlug}`;
  // 「比較6選」のように記事タイトルへ入っている件数を使う
  const count = (String(data.title).match(/比較(\d+)選/) || [])[1] || "6";
  lines.push(`## ${copy.category ?? data.title}${copy.article ? `（${data.title} の中の節）` : ""}`, "", `- ボード: **${copy.board ?? BOARD[slug] ?? "未設定"}**`, `- リンク先: ${url}`, "");
  for (const variant of ["table", "price", "compare"]) {
    let title;
    let desc;
    if (variant === "table") {
      const tt = tableText(slug);
      if (!tt) continue; // 比較表からコストを取れない記事はコスト一覧を作らない
      title = tt.title;
      desc = tt.desc;
    } else {
      title = copy[variant].head.replace(/\n/g, " ");
      desc = description(slug, variant, copy, count);
    }
    lines.push(
      `### [ ] ${VARIANT_LABEL[variant]}（画像: \`pins/${slug}-${variant}.png\`）`,
      "",
      "**タイトル**",
      "```",
      title,
      "```",
      "**説明文**",
      "```",
      desc,
      "```",
      ""
    );
  }
  lines.push("---", "");
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, lines.join("\n"), "utf8");
console.log(`✓ ${path.relative(ROOT, OUT)} を作成しました（${slugs.length}記事 × 3枚）`);
