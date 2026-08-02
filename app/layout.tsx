import type { Metadata } from "next";
import Link from "next/link";
import { SITE } from "@/lib/site";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: `${SITE.name}｜${SITE.tagline}`,
    template: `%s｜${SITE.name}`,
  },
  description: SITE.description,
  // SNSでシェアされたときの表示（OGP / Twitterカード）
  openGraph: {
    type: "website",
    locale: "ja_JP",
    siteName: SITE.name,
    title: `${SITE.name}｜${SITE.tagline}`,
    description: SITE.description,
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE.name}｜${SITE.tagline}`,
    description: SITE.description,
  },
  robots: { index: true, follow: true },
  // Google Search Console の所有権確認用（削除すると確認状態が外れる）
  verification: {
    google: "i6ziGw1Ek3jdQcGwdtBBt_SVwC0AQBzoqptVQSUP9MY",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>
        <header className="site-header">
          <div className="container">
            <Link href="/" className="site-title">
              {SITE.name}
            </Link>
            <p className="site-tagline">{SITE.tagline}</p>
          </div>
        </header>
        <main className="container">{children}</main>
        <footer className="site-footer">
          <div className="container">
            <p className="disclosure">{SITE.affiliateDisclosure}</p>
            <p className="copyright">
              © {new Date().getFullYear()} {SITE.name}
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
