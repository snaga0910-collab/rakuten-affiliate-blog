# 独自ドメインへの引っ越し手順（hitorikurashi-note.com）

2026-09-20 作成。2回目のドメイン変更になるので、**前回漏れた項目を先頭に近いところへ置いている**。

```
現在   https://hitorikurashi-note.vercel.app
新しく  https://hitorikurashi-note.com   ← 2026-09-20 時点で未登録（whoisで確認済み）
```

**旧ドメインはVercelのプロジェクトから外さないこと。** 外すと301が動かなくなり、
これまでの評価と外部リンクが切れる。rakuten-affiliate-blog.vercel.app も付けたままにする。

---

## 1. ドメインを買う（ゆうきさんの作業）

どこで買ってもよい。比べるのは**2年目以降の更新料**。
初年度が数百円でも、更新が数千円になる業者がある。

- お名前.com / ムームードメイン / Xserverドメイン / Cloudflare Registrar など
- Whois情報公開代行（登録者の住所氏名を隠す仕組み）が**無料**かどうかも見る
- 自動更新をオンにする。切れると他人に取られて戻らない

買ったら、管理画面の **DNS設定（DNSレコード設定）** の画面を開けるようにしておく。

## 2. Vercelにドメインを追加する

1. Vercelのダッシュボードで、このプロジェクトを開く
2. **Settings → Domains** を開く
3. **Add Domain** に `hitorikurashi-note.com` を入力
4. `www.hitorikurashi-note.com` も追加する（Vercelが勧めてくる。片方に寄せるため）
5. 画面に**設定すべきDNSレコードの値が表示される**ので、それを控える

> **値は画面に出たものを使う。** apex（wwwなし）はAレコード、wwwはCNAME。
> CNAMEの値はプロジェクトごとに違う文字列（例: `d1d4fc829fe7bc7c.vercel-dns-017.com`）なので、
> 他のサイトに書いてある値をコピーしない。

## 3. DNSレコードを設定する（ドメインを買った業者の画面）

Vercelの画面に出た値を、そのまま登録する。だいたいこの形になる。

```
種類     ホスト名(名前)   値
A        @ （空欄の場合もある）   Vercelの画面に出たIPアドレス
CNAME    www                    Vercelの画面に出た文字列
```

- 反映には数分〜数時間かかる（長いと1日）
- Vercelの Domains 画面で、状態が **Valid Configuration** になれば完了
- 証明書（https）はVercelが自動で取る。待つだけ

## 4. リポジトリ側の変更（私の作業）

URLを書いている場所。**漏れると古いURLが残る。**

| ファイル | 直す内容 |
|---|---|
| `next.config.mjs` | `NEW_ORIGIN` を新ドメインに。旧2ドメイン（rakuten-affiliate-blog / hitorikurashi-note の .vercel.app）からの301を両方残す |
| `lib/site.ts` | 既定のサイトURL |
| `scripts/to-note.mjs` | `SITE_URL` の既定値 |
| `scripts/make-pin-text.mjs` | `SITE_URL` の既定値 |
| `scripts/make-guide-post.mjs` | `SITE` の既定値 |
| `note-summary/meal-delivery.md` | 本文中の絶対URL |
| `OPERATION.md` / `X-POST.md` / `CROWDWORKS.md` / `pins/GUIDE-POST.md` | 記載しているURL |
| `pins/POST.md` / `pins/TODO.md` | `npm run pintext` で再生成 |
| `note-out/*.md` | `npm run note` で再生成 |

記事本文（`content/*.md`）の内部リンクは `/articles/...` の相対パスなので**変更不要**。

そのあと `npm run check` → `npm run build` → コミット → push。

## 5. 外部サービスの登録変更（ゆうきさんの作業）

**ここが前回漏れた。** A8の登録URLが旧ドメインのままで、82本の広告リンクが
未登録サイトで配信されている状態になっていた。

- [ ] **A8** サイトURLを【修正】で変更する。**削除して再登録しない**
      （サイトIDが変わり、審査中の提携申請が消える）
      審査待ちの案件がある場合は、URLを変えたことを問い合わせで伝える
- [ ] **Google Search Console** 新しいプロパティを追加 →
      設定 → アドレス変更 で旧プロパティから新プロパティへ移転
      （301が動いていることが条件。4番の作業が終わってから）
- [ ] **サイトマップ** 新プロパティで `sitemap.xml` を送信
- [ ] **楽天アフィリエイト** サイト情報にURLを登録している場合は変更
- [ ] **note** プロフィールにURLを書いている場合は変更
- [ ] **X** プロフィールのURL
- [ ] **Pinterest** ドメイン認証のやり直し（新規投稿を止めているので後回しでよい）

## 6. 下書き・投稿予定の差し替え（私の作業）

- [ ] noteの下書き7本を、新URL入りに差し替える（publish-hybrid.js の replace）
- [ ] `X-POST.md` の投稿文のURL
- [ ] 公開済みのnote記事19本の本文中のリンク（旧URLは301で飛ぶので急がない）

## 7. 検証

```bash
# 旧ドメインが新ドメインへ301で飛ぶか
curl -sI https://hitorikurashi-note.vercel.app/articles/meal-delivery | grep -iE "^HTTP/|^location:"
curl -sI https://rakuten-affiliate-blog.vercel.app/articles/meal-delivery | grep -iE "^HTTP/|^location:"

# 新ドメインが200を返すか
curl -s -o /dev/null -w "%{http_code}\n" https://hitorikurashi-note.com/articles/meal-delivery

# wwwありが、wwwなしへ飛ぶか
curl -sI https://www.hitorikurashi-note.com/ | grep -iE "^HTTP/|^location:"

# sitemap と canonical が新ドメインになっているか
curl -s https://hitorikurashi-note.com/sitemap.xml | head -5
curl -s https://hitorikurashi-note.com/articles/meal-delivery | grep -o 'rel="canonical" href="[^"]*"'
```

## 順番のまとめ

```
1 ドメインを買う            ゆうき
2 Vercelに追加              ゆうき（画面の値を私に共有）
3 DNSレコードを設定          ゆうき
4 リポジトリのURLを書き換え   私
5 A8・GSCなどの登録変更      ゆうき
6 note下書き・X投稿文の差し替え 私
7 検証                      私
```

**4番より先に5番のGSCアドレス変更をやらないこと。** 301が動いていないと弾かれる。
