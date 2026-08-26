// Xの文字数（重み付き）を数える。半角1・全角2・URLは長さに関係なく一律23。
//   使い方: node scripts/x-weight.mjs "投稿文"
//           echo "投稿文" | node scripts/x-weight.mjs
export function weight(text) {
  const withoutUrls = text.replace(/https?:\/\/\S+/g, "");
  const urlCount = (text.match(/https?:\/\/\S+/g) || []).length;
  let w = 0;
  for (const ch of withoutUrls) {
    const c = ch.codePointAt(0);
    // Xの定義では U+0000–U+10FF などが重み1、それ以外（日本語を含む）が重み2
    w += (c <= 0x10ff || (c >= 0x2000 && c <= 0x200d) || (c >= 0x2010 && c <= 0x201f) || (c >= 0x2032 && c <= 0x2037)) ? 1 : 2;
  }
  return w + urlCount * 23;
}
const arg = process.argv[2];
if (arg) console.log(weight(arg));
