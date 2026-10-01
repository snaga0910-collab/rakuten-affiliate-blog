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

print(f"照合対象 {len(rows)}件")
os.makedirs("review", exist_ok=True)
out = []
for i, r in enumerate(rows, 1):
    price, err = current_price(r["path"])
    if err:
        status = "要確認"
    elif price in r["written"]:
        status = "一致"
    else:
        status = "ズレ"
    out.append([r["slug"], r["name"], r["path"], "/".join(map(str, r["written"])), price or "", status, err])
    print(f'{i:>3}/{len(rows)} {status:4} {r["slug"]:22} 記事{r["written"]} → 現在{price} {err}')
    time.sleep(1.2)

with open("review/price-audit.csv", "w", newline="", encoding="utf-8") as fp:
    w = csv.writer(fp)
    w.writerow(["記事", "商品", "商品パス", "記事の金額", "現在の価格", "判定", "備考"])
    w.writerows(out)
from collections import Counter
c = Counter(r[5] for r in out)
print("\n=== 集計 ===", dict(c))
