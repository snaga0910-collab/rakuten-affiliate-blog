# 記事に書いてある楽天の価格と、いまの商品ページの価格を突き合わせる。
#
# 2026-10-02: 8月16日更新のまま止まっている記事が13本あり、楽天の価格は日々動く。
# ヨシケイで起きた「記事の数字と実際が違う」状態が、楽天側でも起きていないか確かめる。
#
# 使い方: python3 scripts/audit-prices.py  → review/price-audit.csv
import re, glob, os, csv, time, urllib.parse, urllib.request

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124.0 Safari/537.36"

def item_path(aff_url):
    """アフィリエイトURLから item.rakuten.co.jp/<shop>/<item>/ を取り出す"""
    m = re.search(r"pc=([^&]+)", aff_url)
    if not m: return None
    pc = urllib.parse.unquote(m.group(1))
    m2 = re.search(r"item\.rakuten\.co\.jp/([^/]+)/([^/?]+)", pc)
    return f"{m2.group(1)}/{m2.group(2)}" if m2 else None

def current_price(path):
    """商品ページの itemprop=price を読む。取れなければ None"""
    try:
        req = urllib.request.Request(f"https://item.rakuten.co.jp/{path}/", headers={"User-Agent": UA})
        raw = urllib.request.urlopen(req, timeout=30).read()
    except Exception as e:
        return None, f"取得失敗 {type(e).__name__}"
    for enc in ("euc_jp", "utf-8", "shift_jis"):
        try: t = raw.decode(enc); break
        except Exception: t = None
    if t is None: return None, "文字コード不明"
    m = re.search(r'itemprop="price"[^>]*content="(\d+)"', t)
    if not m: return None, "価格が見つからない（販売終了の可能性）"
    return int(m.group(1)), ""

rows = []
for f in sorted(glob.glob("content/*.md")):
    slug = os.path.basename(f)[:-3]
    for line in open(f, encoding="utf-8"):
        if not line.strip().startswith("|"): continue
        if "hb.afl.rakuten" not in line: continue
        link = re.search(r"\[([^\]]+)\]\((https://hb\.afl\.rakuten[^)]+)\)", line)
        if not link: continue
        name, aff = link.group(1), link.group(2)
        path = item_path(aff)
        if not path: continue
        # 行に書かれている金額（カンマ区切り）
        written = [int(x.replace(",", "")) for x in re.findall(r"([\d,]{3,9})\s*円", line)]
        rows.append(dict(slug=slug, name=name[:40], path=path, written=written))

print(f"照合対象 {len(rows)}件", flush=True)
os.makedirs("review", exist_ok=True)
CSV = "review/price-audit.csv"

# 途中で止まっても再開できるよう、1件ずつ追記する。
done = set()
if os.path.exists(CSV):
    with open(CSV, encoding="utf-8") as fp:
        for row in csv.reader(fp):
            if len(row) > 2: done.add(row[2])
    print(f"済み {len(done)}件はとばす", flush=True)
else:
    with open(CSV, "w", newline="", encoding="utf-8") as fp:
        csv.writer(fp).writerow(["記事", "商品", "商品パス", "記事の金額", "現在の価格", "判定", "備考"])

for i, r in enumerate(rows, 1):
    if r["path"] in done: continue
    price, err = current_price(r["path"])
    status = "要確認" if err else ("一致" if price in r["written"] else "ズレ")
    with open(CSV, "a", newline="", encoding="utf-8") as fp:
        csv.writer(fp).writerow([r["slug"], r["name"], r["path"],
                                 "/".join(map(str, r["written"])), price or "", status, err])
    print(f'{i:>3}/{len(rows)} {status:4} {r["slug"]:22} 記事{r["written"]} → 現在{price} {err}', flush=True)
    time.sleep(0.6)

from collections import Counter
with open(CSV, encoding="utf-8") as fp:
    rowsv = list(csv.reader(fp))[1:]
print("\n=== 集計 ===", dict(Counter(x[5] for x in rowsv)), flush=True)
