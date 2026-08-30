// 検証用ピンの投稿シートを作る。
//   使い方: npm run guidepost
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { GUIDE_PINS } from "./guide-pin-data.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://hitorikurashi-note.vercel.app";
const BOARD = {
  "買い替えの目安": "一人暮らしの買い替えメモ",
  "買い物のとき用": "一人暮らしの買い替えメモ",
  "部屋干し": "一人暮らしの洗濯・柔軟剤えらび",
};
const F = "`".repeat(3);

const L = [
  "# Pinterest 検証用ピン（保存されるか試す5枚）",
  "",
  "30日で882表示・保存0・アウトバウンドクリック0だった。5か月・49枚すべてが価格比較表で、",
  "保存が1件もない。価格表が保存されない理由は構造的だと考えて、「後でもう一度開くもの」を作った。",
  "",
  "  価格は変わる      → 保存しても半年後には古い",
  "  一度読めば終わる    → 「◯◯が安い」を知ったら用済み",
  "",
  "## 試すこと",
  "",
  "- **既存の57枚は投稿を止める。** 保存0が確定しているので、続けても同じ結果が積み上がるだけ",
  "- **この5枚だけを出す。** 1日1枚、5日で出し切って2週間ようすを見る",
  "- **判定**：保存が1件も付かなければ、このジャンルとPinterestの相性が悪いと結論する。1件でも付けば、その型を増やす",
  "",
  "## 先にボードを1つ作ってください",
  "",
  "「**一人暮らしの買い替えメモ**」を新規作成します。既存のボードは商品カテゴリで分かれていますが、",
  "今回は「あとで見返す情報」という別の軸なので、混ぜると性格がぼやけます。",
  "",
  "---",
  "",
];

GUIDE_PINS.forEach((p, i) => {
  const title = p.kind === "table" ? `${p.subject} ${p.label}` : p.head.replace(/\n/g, " ");
  const desc =
    p.kind === "table"
      ? `${p.subject}を${p.label}でまとめました。${p.rows.map((r) => `${r.name} ${r.cost}`).join("／")}。${p.note ?? ""}`
      : `${p.head.replace(/\n/g, "")}｜${p.lead}。${p.points.join("。")}。`;
  L.push(
    `## ${i + 1}日目：${p.id}`,
    "",
    `- 画像: \`pins/guide-${p.id}.png\``,
    `- ボード: **${BOARD[p.category]}**`,
    `- リンク先: ${SITE}${p.url}`,
    "",
    "**タイトル**",
    F,
    title,
    F,
    "**説明文**",
    F,
    `${desc} #一人暮らし #暮らしの知恵 #節約 #買い替え #ひとり暮らし`,
    F,
    "",
    "---",
    ""
  );
});

fs.writeFileSync(path.join(__dirname, "..", "pins", "GUIDE-POST.md"), L.join("\n"));
console.log(`✓ pins/GUIDE-POST.md を作成しました（${GUIDE_PINS.length}枚）`);
