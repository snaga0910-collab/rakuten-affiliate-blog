#!/bin/bash
# 消耗品note(kaisyainkurashi)へ下書き投稿するラッパー。
# 投資アカウントのセッション(~/.note-state.json)を上書きしないよう、
# 専用のセッションファイルを使う。
#
#   使い方:
#     ./scripts/note-post.sh login          … 初回ログイン(自分でログイン操作)
#     ./scripts/note-post.sh oral-care      … 下書き投稿
#     ./scripts/note-post.sh oral-care publish … 公開まで(非推奨・まず下書きで確認)
set -euo pipefail

POSTER_DIR="/Users/nagakurashota/Documents/Note投稿くん"
BLOG_DIR="$(cd "$(dirname "$0")/.." && pwd)"
export NOTE_POST_MCP_STATE_PATH="$HOME/.note-state-kaisyainkurashi.json"

if [ $# -lt 1 ]; then
  echo "使い方: $0 <login|記事slug> [draft|publish]"
  echo "例:     $0 login"
  echo "        $0 oral-care"
  exit 1
fi

if [ "$1" = "login" ]; then
  echo "消耗品アカウント(kaisyainkurashi)でログインします。"
  echo "セッション保存先: $NOTE_POST_MCP_STATE_PATH"
  echo "ブラウザが開いたら、ご自分でログインしてください。"
  cd "$POSTER_DIR"
  exec npm run login
fi

SLUG="$1"
MODE="${2:-draft}"
ARTICLE="$BLOG_DIR/note-out/$SLUG.md"
THUMB="$BLOG_DIR/public/thumbnails/$SLUG.png"

if [ ! -f "$ARTICLE" ]; then
  echo "❌ 記事が見つかりません: $ARTICLE"
  echo "   先に 'npm run note' で変換してください。"
  exit 1
fi

# サムネイルが無ければ生成しておく（npm run thumb 相当）
if [ ! -f "$THUMB" ]; then
  echo "サムネイルが無いため生成します..."
  (cd "$BLOG_DIR" && node scripts/make-thumbnails.mjs "$SLUG") || true
fi
if [ ! -f "$THUMB" ]; then
  echo "⚠ サムネイルを用意できませんでした。サムネなしで投稿します。"
  THUMB=""
fi

if [ ! -f "$NOTE_POST_MCP_STATE_PATH" ]; then
  echo "❌ ログインセッションがありません。"
  echo "   先に '$0 login' を実行してください。"
  exit 1
fi

# --- 二重投稿の防止 -------------------------------------------------
# 2026-08-13に、すでに公開済みの記事の下書きを重ねて作ってしまった。
# 原因は、note側の現状を取り直さずに古い情報で判断したこと。
# 投稿の直前に必ずnoteの一覧を取得し、同じタイトルがあれば止める。
TITLE=$(grep -m1 '^title:' "$ARTICLE" | sed 's/^title:[[:space:]]*//')
echo "note側の現状を確認中..."
EXISTING=$(cd "$POSTER_DIR" && node scripts/list-notes.mjs 2>/dev/null || true)

if [ -n "$EXISTING" ] && [ -n "$TITLE" ]; then
  if echo "$EXISTING" | grep -Fq "$TITLE"; then
    echo ""
    echo "❌ 中止：同じタイトルの記事が note にすでにあります。"
    echo "   タイトル: $TITLE"
    echo "$EXISTING" | grep -F "$TITLE" | sed 's/^/   → /'
    echo ""
    echo "   重複して作らないため、ここで止めます。"
    echo "   意図的に作り直す場合は、note側の該当記事を先に削除してください。"
    exit 1
  fi
  echo "  OK: 同じタイトルはありません"
else
  echo "  ⚠ 一覧を取得できませんでした。重複していないか自分で確認してください。"
fi
# --------------------------------------------------------------------

echo "記事: $ARTICLE"
echo "サムネ: ${THUMB:-なし}"
echo "モード: $MODE"
cd "$POSTER_DIR"
exec node scripts/publish-hybrid.js "$ARTICLE" "$THUMB" "$MODE"
