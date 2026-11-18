import type { Metadata, Viewport } from "next";
import { Inter_Tight } from "next/font/google";
import Script from "next/script";
import { LocationSheet } from "@/components/place/LocationSheet";
import { Footer } from "@/components/shell/Footer";
import { Header } from "@/components/shell/Header";
import { SITE_DESCRIPTION, SITE_NAME, SITE_TITLE, siteUrl } from "@/lib/site";
import "./globals.css";
import "../styles/shell.css";
import "../styles/reading.css";
import "../styles/map.css";
import "../styles/trend.css";
import "../styles/pages.css";

const app = Inter_Tight({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-app",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: SITE_TITLE,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    locale: "en_IN",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4efe6" },
    { media: "(prefers-color-scheme: dark)", color: "#100e0c" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${app.variable} h-full`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col antialiased">
        <Script id="hawa-theme" strategy="beforeInteractive">
          {`(function(){try{var t=localStorage.getItem("hawa-theme");if(t!=="light"&&t!=="dark"){t=localStorage.getItem("aqi-desk-theme")}if(t!=="light"&&t!=="dark"){t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme="light"}})();`}
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
