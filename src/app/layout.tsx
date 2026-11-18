import type { Metadata } from "next";
import { Inter_Tight } from "next/font/google";
import Script from "next/script";
import { LocationSheet } from "@/components/place/LocationSheet";
import { Footer } from "@/components/shell/Footer";
import { Header } from "@/components/shell/Header";
import { SITE_DESCRIPTION, siteUrl } from "@/lib/site";
import "./globals.css";

const app = Inter_Tight({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-app",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: "AQI Desk — official India AQI from CPCB stations",
    template: "%s · AQI Desk",
  },
  description: SITE_DESCRIPTION,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${app.variable} h-full`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col antialiased">
        <Script id="aqi-desk-theme" strategy="beforeInteractive">
          {`(function(){try{var k="aqi-desk-theme";var t=localStorage.getItem(k);if(t!=="light"&&t!=="dark"){t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme="light"}})();`}
        </Script>
        <a className="skip-link" href="#content">
          Skip to content
        </a>
        <Header />
        <main
          id="content"
          tabIndex={-1}
          className="site-frame flex-1 px-5 py-5 md:px-8 md:py-8"
        >
          {children}
        </main>
        <Footer />
        <LocationSheet />
      </body>
    </html>
  );
}
