// 「保存されるピン」の検証用データ。
//
// 2026-08-30: Pinterestは30日で882表示・保存0・アウトバウンドクリック0だった。
// 5か月・49ピン・全部が価格比較表で、保存が1件もない。
// 価格表が保存されない理由は構造的だと考えた。
//   - 価格は変わるので、保存しても半年後には古い
//   - 一度読めば終わる（「◯◯が安い」を知ったら用済み）
// そこで「後でもう一度開くもの」を作って、保存が付くか2週間試す。
//
// ここに書く数字は、すべて記事で調べた公称値か、記事内で出した実額に限る。
// 早見表は1枚で完結するぶん、間違えたときに訂正が届かない。
export const GUIDE_PINS = [
  {
    id: "replace-cycle",
    kind: "table",
    category: "買い替えの目安",
    subject: "消耗品の交換時期",
    label: "一人暮らしの早見表",
    hero: "貼っておく用",
    countLabel: "公称値でまとめました",
    footNote: "各メーカーの公表値／PR",
    cta: "根拠と実額はブログで →",
    url: "/articles/water-filter",
    rows: [
      { name: "浄水器カートリッジ（ポット）", cost: "4週間" },
      { name: "歯ブラシ・替えブラシ", cost: "3か月" },
      { name: "浄水器カートリッジ（蛇口）", cost: "3か月" },
      { name: "洗濯槽クリーナー", cost: "1〜2か月" },
      { name: "浄水型サーバーのフィルター", cost: "8か月〜" },
    ],
    note: "カートリッジは「期間」と「総ろ過水量」の早いほうで交換します",
  },
  {
    id: "filter-limit",
    kind: "compare",
    category: "買い替えの目安",
    head: "浄水カートリッジ\n期間だけ見ると足りない",
    lead: "交換は「期間」か「水量」の早いほう",
    points: [
      "ポット型は4週間 または 150L",
      "蛇口直結は3か月 または 900L",
      "たくさん使う人は期間より先に来る",
    ],
    footNote: "BRITA・クリンスイの公表値／PR",
    cta: "6商品の年間費用はブログで →",
    url: "/articles/water-filter",
  },
  {
    id: "price-guide",
    kind: "table",
    category: "買い物のとき用",
    subject: "1回あたりの相場",
    label: "高いか安いかの目安",
    hero: "店頭で開く用",
    countLabel: "当サイトの比較記事より",
    footNote: "価格は執筆時点／PR",
    cta: "商品名つきの比較はブログで →",
    url: "/articles/laundry-detergent",
    rows: [
      { name: "食器用洗剤", cost: "1.6〜4.3円" },
      { name: "歯磨き粉", cost: "2.7〜21.9円" },
      { name: "シャンプー詰め替え", cost: "2.8〜8.5円" },
      { name: "柔軟剤", cost: "4〜15円" },
      { name: "洗濯洗剤", cost: "13〜25円" },
    ],
    note: "すべて1回あたり。容量ではなく使用量で割った金額です",
  },
  {
    id: "laundry-order",
    kind: "table",
    category: "部屋干し",
    subject: "生乾き臭の対策",
    label: "効く順とかかる費用",
    hero: "まず0円の3つ",
    countLabel: "順番に試す",
    footNote: "各比較記事の実データより／PR",
    cta: "くわしい手順はブログで →",
    url: "/articles/laundry-odor",
    rows: [
      { name: "すぐ干す・風を当てる", cost: "0円" },
      { name: "詰め込みすぎない", cost: "0円" },
      { name: "洗濯槽を洗う", cost: "1回183円〜" },
      { name: "洗剤を部屋干し用に", cost: "1回13円〜" },
      { name: "柔軟剤を消臭タイプに", cost: "1回4円〜" },
    ],
    note: "効く順とお金がかかる順は逆でした",
  },
  {
    id: "laundry-mistake",
    kind: "compare",
    category: "部屋干し",
    head: "洗剤を変えても\n消えないとき",
    lead: "原因は洗剤の性能ではないかもしれません",
    points: [
      "濡れたまま放置すると菌が増える",
      "洗濯槽の汚れが毎回移っている",
      "洗濯物は槽の7〜8分目まで",
    ],
    footNote: "花王の公表資料と各比較記事より／PR",
    cta: "順番と費用はブログで →",
    url: "/articles/laundry-odor",
  },
];
