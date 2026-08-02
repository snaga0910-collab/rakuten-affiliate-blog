# Vercel 公開手順

ブログをインターネットに公開する手順。所要 10〜15 分。
**GitHubアカウントへのログインが必要な操作のため、ここは自分で行う必要があります。**

準備は完了しています（記事5本・sitemap・robots・構造化データすべて動作確認済み）。

---

## STEP 1. GitHub に空のリポジトリを作る

1. https://github.com/new を開く
2. **Repository name**: `rakuten-affiliate-blog`
3. **Public / Private**: どちらでも可（Privateでも Vercel は連携できる）
4. **重要**: 「Add a README file」「Add .gitignore」「Choose a license」は
   **すべてチェックを外す**（すでにファイルがあるため衝突する）
5. 「Create repository」をクリック

## STEP 2. 作ったリポジトリに push する

作成後の画面に出る URL（`https://github.com/<ユーザー名>/rakuten-affiliate-blog.git`）を使います。
ターミナルで次を実行してください（`<ユーザー名>` を自分のものに置き換える）。

```bash
cd "/Users/nagakurashota/Documents/rakuten-affiliate-blog"
git remote add origin https://github.com/<ユーザー名>/rakuten-affiliate-blog.git
git branch -M main
git push -u origin main
```

初回は GitHub の認証を求められます。ブラウザが開いたら許可してください。

## STEP 3. Vercel でインポートする

1. https://vercel.com にアクセスし、**GitHubアカウントでログイン**
2. 「Add New...」→「Project」
3. `rakuten-affiliate-blog` を探して「Import」
4. 設定はすべて**デフォルトのまま**でOK（Next.js が自動検出される）
5. 「Deploy」をクリック → 1〜2分待つ

完了すると `https://rakuten-affiliate-blog-xxxx.vercel.app` のようなURLが発行されます。
**このURLを控えてください。**

## STEP 4. 公開URLを設定に反映する（重要）

sitemap・canonical・OGP は「サイトの正式URL」を使うため、
発行された実際のURLに合わせる必要があります。

Vercel の画面で **Settings → Environment Variables** を開き、次を追加します。

| Key | Value |
|-----|-------|
| `NEXT_PUBLIC_SITE_URL` | 発行された自分のURL（例: `https://rakuten-affiliate-blog-xxxx.vercel.app`）|

保存したら **Deployments → 最新のデプロイ → Redeploy** で再デプロイしてください。

> URLを控えて教えてもらえれば、`lib/site.ts` の既定値の方も更新できます。

## STEP 5. Google に登録する（検索に載せるため）

公開しただけでは検索結果に出ません。登録すると認識が早くなります。

1. https://search.google.com/search-console にアクセス
2. 「URLプレフィックス」に公開URLを入力して追加
3. 所有権の確認（HTMLタグ方式を選ぶと、貼り付けるタグが表示される
   → そのタグを教えてもらえれば、こちらでコードに埋め込みます）
4. 確認後、「サイトマップ」に `sitemap.xml` を送信

---

## 以降の更新フロー

記事を追加・修正したら、次だけで自動的に公開に反映されます。

```bash
cd "/Users/nagakurashota/Documents/rakuten-affiliate-blog"
npm run import     # 楽天ツールの記事を取り込む
git add -A && git commit -m "記事を追加"
git push           # → Vercel が自動でデプロイ
```

## 独自ドメインを使いたくなったら

Vercel の Settings → Domains から追加できます。
ドメインは お名前.com / Cloudflare / Google Domains などで年1,000〜2,000円程度。
無料の `.vercel.app` のままでも記事は検索に載るので、後回しで問題ありません。
