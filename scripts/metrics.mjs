// 週次の数字を metrics.csv に記録する（PDCAのCheck用）。
//   使い方: npm run metrics            … 今週の行を追記（値は空欄）
//           npm run metrics -- 12 3 40 5 0
//              → 検索表示 12 / 検索クリック 3 / ピンクリック 40 / 楽天クリック 5 / 成果 0
//
// 数字は各管理画面から手で拾う（自動取得はAPIキーが必要なため行わない）:
//   ①②Search Console / ③Pinterestアナリティクス / ④⑤楽天アフィリエイト レポート
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CSV = path.join(__dirname, "..", "metrics.csv");
const HEAD =
  "週の開始日,検索表示回数,検索クリック,ピンのクリック,楽天クリック,楽天成果件数,楽天報酬額,A8クリック,A8成果件数,A8報酬額,メモ";

/** その週の月曜日を YYYY-MM-DD で返す。 */
function weekStart(d = new Date()) {
  const x = new Date(d);
  const diff = (x.getDay() + 6) % 7; // 月曜=0
  x.setDate(x.getDate() - diff);
  return x.toISOString().slice(0, 10);
}

if (!fs.existsSync(CSV)) fs.writeFileSync(CSV, HEAD + "\n", "utf8");

const week = weekStart();
const rows = fs.readFileSync(CSV, "utf8").trim().split("\n");
if (rows.some((r) => r.startsWith(week))) {
  console.log(`${week} の行はすでにあります。数字は metrics.csv を直接編集してください。`);
  process.exit(0);
}

const a = process.argv.slice(2);
const row = [week, a[0] ?? "", a[1] ?? "", a[2] ?? "", a[3] ?? "", a[4] ?? "", a[5] ?? "", a[6] ?? ""];
fs.appendFileSync(CSV, row.join(",") + "\n", "utf8");
console.log(`✓ metrics.csv に ${week} の行を追加しました`);

// 直近4週を表示して傾向を見る
const all = fs.readFileSync(CSV, "utf8").trim().split("\n").slice(1);
const recent = all.slice(-4);
if (recent.length > 1) {
  console.log("\n直近の推移:");
  console.log("  週開始      表示  クリック  ピン  楽天  成果");
  for (const r of recent) {
    const c = r.split(",");
    console.log(
      `  ${c[0]}  ${(c[1] || "-").padStart(4)}  ${(c[2] || "-").padStart(7)}  ` +
        `${(c[3] || "-").padStart(4)}  ${(c[4] || "-").padStart(4)}  ${(c[5] || "-").padStart(4)}`
    );
  }
}
