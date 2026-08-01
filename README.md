# ひとり暮らしの消耗品ノート（楽天アフィリエイト比較記事ブログ）

一人暮らし会社員向けに、買い替え消耗品を正直に比較するレビューサイト。
Next.js（App Router）+ Markdown で作り、Vercel で自動デプロイする。

比較記事の中身は別リポジトリの楽天ツール
（`../rakuten-affiliate-tool`、`python -m tool article --genre <slug>`）で生成する。

## 開発

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # 本番ビルド（全記事を静的生成）
```

## 記事の追加フロー

1. 楽天ツールで比較記事を作る
   ```bash
   cd ../rakuten-affiliate-tool
   python -m tool article --genre oral-care        # 素材＋執筆プロンプト生成
   # prompt_article.md を Claude に貼って本文 article.md を作成・保存
   ```
2. このリポジトリに取り込む
   ```bash
   npm run import   # output/articles/*/article.md → content/*.md（frontmatter付与）
   ```
3. 確認して公開
   ```bash
   git add . && git commit -m "記事追加: <genre>"
   git push         # Vercel が自動デプロイ
   ```

## 構成

| パス | 役割 |
|------|------|
| `content/*.md` | 記事（frontmatter: title/description/category/date） |
| `app/page.tsx` | トップ（記事一覧） |
| `app/articles/[slug]/page.tsx` | 記事ページ（静的生成） |
| `lib/articles.ts` | Markdown読み込み・HTML化（外部リンクは rel="sponsored" 付与） |
| `lib/site.ts` | サイト名・説明・アフィリエイト表示（ここを編集すれば全ページ反映） |
| `scripts/import-articles.mjs` | 楽天ツールの記事を content/ に取り込む |

## 規約対応

- 全ページ下部にアフィリエイト表示（`lib/site.ts` の `affiliateDisclosure`）
- アフィリンクは `rel="sponsored nofollow noopener"` / `target="_blank"`
- 記事本文の禁止表現チェックは楽天ツール側（`docs/article_design.md`）で実施

## デプロイ（Vercel）

1. このリポジトリを GitHub に push
2. Vercel でリポジトリを Import（設定はデフォルトで Next.js を自動検出）
3. 以降は `git push` で自動デプロイ。独自ドメインは後から Vercel の設定で追加可能
