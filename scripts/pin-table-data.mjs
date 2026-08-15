// 記事の比較表から「商品名 × 1回あたりコスト」を取り出す。
// コスト一覧ピン（table）と、その投稿文の両方で使う。
//
// 数字は記事本文の表そのものなので、記事を更新すればピンも自動で追従する。
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import matter from "gray-matter";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONTENT_DIR = path.join(__dirname, "..", "content");

/** 記事タイトルから商品ジャンル名だけを取り出す（「マウスウォッシュおすすめ比較6選｜…」→「マウスウォッシュ」）。 */
export function subjectOf(title) {
  return String(title)
    .split("｜")[0]
    .replace(/おすすめ.*$/, "")
    .replace(/比較\d+選.*$/, "")
    .trim();
}

/** 商品名から販促の飾りを落とす。 */
function cleanName(name) {
  return name
    .replace(/【[^】]*】|＼[^／]*／|\[[^\]]*\]|［[^］]*］|（[^）]*）|\([^)]*\)/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** ピンの1行に収まる長さへ詰める。説明文には詰めない full を使う。 */
function shortName(name, len = 16) {
  return name.length > len ? name.slice(0, len) + "…" : name;
}

function cells(line) {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
}

/**
 * 記事のコスト一覧を返す。
 *   { subject, label, rows: [{name, cost, yen}], count }
 * コスト列が無い記事は価格列で代用する。表が複数ある記事は行数の多いものを使う。
 */
export function costTable(slug, override) {
  // 比較表が「使う量 × 各社」のような行列になっている記事は自動で拾えない。
  // その場合は pin-copy.mjs 側で table を手書きしてもらう。
  if (override) return override;

  const raw = fs.readFileSync(path.join(CONTENT_DIR, `${slug}.md`), "utf8");
  const { data, content } = matter(raw);

  // 連続する「|」行を1つの表としてまとめ、行数がいちばん多い表を採用する
  let best = null;
  let block = [];
  const flush = () => {
    if (block.length >= 3 && (!best || block.length > best.length)) best = block;
    block = [];
  };
  for (const line of content.split("\n")) {
    if (line.trim().startsWith("|")) block.push(line);
    else flush();
  }
  flush();
  if (!best) return null;

  const rows = best.map(cells);
  const header = rows[0];
  const body = rows.slice(rows[1].every((c) => /^:?-{2,}:?$/.test(c)) ? 2 : 1);

  let idx = header.findIndex((h) => /あたり/.test(h));
  if (idx < 0) idx = header.findIndex((h) => /^価格/.test(h));
  if (idx < 0) return null;

  const out = [];
  for (const r of body) {
    const m = (r[idx] ?? "").match(/約?([\d,]+(?:\.\d+)?)\s*円/); // 「約2.1円」の小数も拾う
    if (!m) continue; // 「本体セット」など数値でないものは載せない
    const link = (r[0] || "").match(/\[([^\]]+)\]\(/);
    const full = cleanName(link ? link[1] : r[0]);
    out.push({
      full,
      name: shortName(full),
      cost: r[idx].replace(/\s+/g, ""),
      yen: Number(m[1].replace(/,/g, "")),
    });
  }
  if (out.length < 3) return null;
  out.sort((a, b) => a.yen - b.yen);

  return {
    subject: subjectOf(data.title),
    // 「1回あたり」等はそのまま、コスト列が無く価格列を使った記事は「価格」
    label: header[idx].replace(/目安$/, "").trim(),
    rows: out,
    count: body.length,
  };
}
