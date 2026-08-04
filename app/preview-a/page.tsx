// デザイン案A（ノート・手帳）の見本ページ。
// 実際のオーラルケア記事と楽天の実データを流し込んでいるので、
// 公開したときの見え方をそのまま確認できる。
import fs from "fs";
import path from "path";
import type { Metadata } from "next";
import "./preview-a.css";

export const metadata: Metadata = {
  title: "デザイン案A（ノート）",
  robots: { index: false, follow: false }, // 見本なので検索には出さない
};

type P = {
  name: string; price: number; review: number; rating: number;
  url: string; image: string; shop: string;
};

function load(): P[] {
  const f = path.join(process.cwd(), "data", "products.json");
  return (JSON.parse(fs.readFileSync(f, "utf8")) as Record<string, P[]>)["oral-care"];
}

/** 商品名から販促の飾りを落として短くする。 */
function clean(n: string, len = 34) {
  const s = n.replace(/【[^】]*】|＼[^／]*／|\[[^\]]*\]/g, "").replace(/\s+/g, " ").trim();
  return s.length > len ? s.slice(0, len) + "…" : s;
}

// 記事の比較表と同じ値（1回あたりコスト・タイプ・向く人）
const COST: Record<string, { cost: string; n: number; type: string; who: string }> = {
  モンダミン: { cost: "約37円", n: 37, type: "控えめ・低刺激", who: "オフィスで使う会社員" },
  リステリン: { cost: "約20円", n: 20, type: "強め・アルコール配合", who: "刺激のある使用感が好きな人" },
  コンクール: { cost: "約3円", n: 3, type: "低刺激・ノンアルコール", who: "低刺激で長く使いたい人" },
  クリニカ: { cost: "約17円", n: 17, type: "―（フロス）", who: "フロスが続かなかった人" },
  GUM: { cost: "約5円", n: 5, type: "―（フロス）", who: "まず安く始めたい人" },
  ジェットウォッシャー: { cost: "消耗品なし", n: 9999, type: "水圧で調整", who: "フロスが苦手な人" },
};
const keyOf = (n: string) => Object.keys(COST).find((k) => n.includes(k)) ?? "";

export default function PreviewA() {
  const items = load();
  const chart = fs.readFileSync(
    path.join(process.cwd(), "public", "charts", "oral-care-cost.svg"), "utf8"
  );
  const rows = [...items].sort((a, b) => (COST[keyOf(a.name)]?.n ?? 0) - (COST[keyOf(b.name)]?.n ?? 0));
  const cheapest = rows[0];

  return (
    <div className="pa">
      <div className="pa-sheet">
        <header className="pa-head">
          <span className="pa-kicker">オーラルケア ／ 記録 No.01</span>
          <h1 className="pa-title">
            マウスウォッシュおすすめ比較6選<br />市販で続けやすい商品を正直レビュー
          </h1>
          <div className="pa-meta num">
            <span>調べた日：<b>2026-08-02</b></span>
            <span>比較した商品：<b>6点</b></span>
            <span>1回あたり：<b>3円 〜 37円</b></span>
          </div>
        </header>

        <div className="pa-body">
          <p>
            市販のマウスウォッシュは種類が多く、どれを選べばいいか迷う人も多いはずです。
            ノンアルコールの低刺激タイプから殺菌感の強いタイプまで幅広く、
            ドラッグストアの棚の前で決めきれない——そんな声をよく聞きます。
          </p>
          <p>
            この記事では、忙しい社会人でも毎日続けやすいマウスウォッシュ・フロスのおすすめ6商品を、
            <strong>1回あたりのコスト</strong>・刺激・使うシーンの観点で正直に比較します。
          </p>

          <div className="pa-memo">
            <span className="pa-memo-label">この記事の前提</span>
            すべての商品を実際に使ったわけではありません。使っているものは体験を書き、
            それ以外は価格・内容量・レビューをもとに整理しています。
            1回あたりのコストは、内容量と一般的な使用量から自分で計算した概算です。
          </div>

          <h2>まず結論：1回あたりで比べると10倍以上ちがう</h2>
          <p>
            ボトルの値段だけ見ていると分からないのですが、
            <strong>同じ「1回分」で比べると3円から37円まで開きがありました</strong>。
            毎日使うものなので、ここが効いてきます。
          </p>

          <figure className="pa-fig">
            <div dangerouslySetInnerHTML={{ __html: chart }} />
            <figcaption>
              内容量と一般的な使用量からの概算（洗口液は1回20ml、濃縮タイプは1回約0.3ml、
              フロスは1回約40cmとして計算）。実際の使用量には個人差があります。
            </figcaption>
          </figure>

          <h2>マウスウォッシュとフロス、どっちを優先すべき？</h2>
          <p>
            先に、いちばん多い迷いに答えておきます。大前提として、歯垢（プラーク）はうがいだけでは
            落としきれず、<strong>歯ブラシやフロスで物理的に取り除くのが基本</strong>です。
            マウスウォッシュは歯磨きの代わりにはなりません。
          </p>

          <div className="pa-steps">
            <div className="pa-step">
              <div className="no num">1</div>
              <div>
                <div className="t">歯磨き</div>
                <div className="d">歯ブラシで歯の表面の歯垢を落とす</div>
              </div>
            </div>
            <div className="pa-arrow">↓</div>
            <div className="pa-step">
              <div className="no num">2</div>
              <div>
                <div className="t">フロス</div>
                <div className="d">歯ブラシが届かない歯間の汚れを物理的に取る</div>
              </div>
            </div>
            <div className="pa-arrow">↓</div>
            <div className="pa-step">
              <div className="no num">3</div>
              <div>
                <div className="t">マウスウォッシュ</div>
                <div className="d">仕上げに口全体をゆすいで口臭ケア</div>
              </div>
            </div>
          </div>

          <h2>比較表</h2>
          <p>まず表だけで候補を絞れるように、実データを並べました。</p>

          <div className="pa-ledger">
            <table>
              <thead>
                <tr>
                  <th colSpan={2}>商品</th>
                  <th>価格</th>
                  <th>1回あたり</th>
                  <th>刺激／タイプ</th>
                  <th>向いている人</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => {
                  const c = COST[keyOf(p.name)];
                  return (
                    <tr key={p.url}>
                      <td>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img className="thumb" src={p.image} alt="" loading="lazy" />
                      </td>
                      <td>
                        <div className="pname">
                          <a href={p.url} target="_blank" rel="sponsored nofollow noopener">
                            {clean(p.name)}
                          </a>
                        </div>
                        <div className="pshop num">
                          ★{p.rating.toFixed(1)}・{p.review.toLocaleString()}件／{p.shop}
                        </div>
                      </td>
                      <td className="num">{p.price.toLocaleString()}円</td>
                      <td className="cost">
                        {c?.cost}
                        {p === cheapest && <span className="best">最小</span>}
                      </td>
                      <td>{c?.type}</td>
                      <td>{c?.who}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <h2>マウスウォッシュ3つを比較</h2>

          {rows
            .filter((p) => ["コンクール", "リステリン", "モンダミン"].includes(keyOf(p.name)))
            .map((p) => {
              const k = keyOf(p.name);
              const c = COST[k];
              const text: Record<string, { body: string; ok: string; ng: string }> = {
                コンクール: {
                  body: "歯科でもよく見かける濃縮タイプ。コップの水に数滴たらして使うため1本がとても長持ちします。ノンアルコールで低刺激、就寝前の集中ケアに向いています。",
                  ok: "低刺激でじっくりケアしたい人。就寝前の習慣にしたい人。",
                  ng: "希釈の手間を面倒に感じる人。初期費用を抑えたい人。",
                },
                リステリン: {
                  body: "1000ml×6本とストック買い前提の大容量セット。口臭・歯垢・歯ぐきなど複数の悩みをまとめてケアする位置づけで、「効いている感じ」が欲しい人に支持されています。",
                  ok: "刺激のある使用感が好きで、自宅でまとめ買いしたい人。",
                  ng: "アルコールの刺激が苦手な人。省スペースで置きたい人。",
                },
                モンダミン: {
                  body: "個包装のポーションタイプ。デスクの引き出しやカバンに数個入れておけば、ランチのあとや打ち合わせ前にサッと使えます。ボトルを持ち歩く必要がありません。",
                  ok: "外出先・オフィスで手早く口臭ケアしたい人。低刺激が好みの人。",
                  ng: "自宅でたっぷり使いたい人（1回あたりのコストは割高）。",
                },
              };
              const t = text[k];
              return (
                <div className="pa-item" key={p.url}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.image} alt="" loading="lazy" />
                  <div>
                    <h4>
                      <a href={p.url} target="_blank" rel="sponsored nofollow noopener">
                        {clean(p.name, 40)}
                      </a>
                    </h4>
                    <div className="facts num">
                      <span>{p.price.toLocaleString()}円</span>
                      <span>1回 <b>{c?.cost}</b></span>
                      <span>★{p.rating.toFixed(1)}（{p.review.toLocaleString()}件）</span>
                    </div>
                    <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.85 }}>{t.body}</p>
                    {k === "モンダミン" && (
                      <p style={{ margin: "10px 0 0", fontSize: 14, lineHeight: 1.85 }}>
                        モンダミンは以前から使っていて、昼食後に口の中がさっぱりするのが
                        気に入っています。ペパーミントは刺激が強すぎないので、
                        口をゆすいだあとにヒリつきが残らないのが自分には合っていました。
                      </p>
                    )}
                    <div className="pa-fit">
                      <div className="ok"><b>向いている人</b>{t.ok}</div>
                      <div className="ng"><b>向かない人</b>{t.ng}</div>
                    </div>
                  </div>
                </div>
              );
            })}

          <h2>よくある質問</h2>
          <dl className="pa-qa">
            <dt>マウスウォッシュだけで歯垢は取れる？</dt>
            <dd>取れません。歯垢は歯ブラシやフロスで物理的に落とすのが基本で、マウスウォッシュはあくまで補助・口臭ケアです。</dd>
          </dl>
          <dl className="pa-qa">
            <dt>ノンアルコールとアルコール配合、どっちがいい？</dt>
            <dd>刺激が苦手な人や口の乾きが気になる人はノンアルコール、清涼感を求める人はアルコール配合が向きます。効果の優劣というより、好みと「続けられるか」で選ぶのが実際的です。</dd>
          </dl>

          <div className="pa-verdict">
            <h3>結局どれを選べばいい？</h3>
            <div className="pa-pick">
              <div className="case">フロス初心者・まず安く</div>
              <div className="ans"><b>GUM デンタルフロス 40m</b>（480円・1回<span className="num">約5円</span>）</div>
            </div>
            <div className="pa-pick">
              <div className="case">オフィスで使う会社員</div>
              <div className="ans"><b>モンダミン ポーションパック</b>（個包装で持ち運べる）</div>
            </div>
            <div className="pa-pick">
              <div className="case">刺激のある使用感が好き</div>
              <div className="ans"><b>リステリン トータルケア</b>（大容量・1回<span className="num">約20円</span>）</div>
            </div>
            <p style={{ margin: "18px 0 0", fontSize: 14.5 }}>
              決めきれないなら、<strong>まずは480円のGUMから</strong>。
              歯垢を物理的に落とす意味で効果を実感しやすく、失敗しても数百円です。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
