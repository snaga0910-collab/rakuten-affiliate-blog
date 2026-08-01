import type { Metadata } from "next";
import Link from "next/link";
import { SITE } from "@/lib/site";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: `${SITE.name}｜${SITE.tagline}`,
    template: `%s｜${SITE.name}`,
  },
  description: SITE.description,
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
