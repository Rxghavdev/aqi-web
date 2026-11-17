import type { Metadata } from "next";
import { Fraunces, Outfit } from "next/font/google";
import { Footer } from "@/components/shell/Footer";
import { Header } from "@/components/shell/Header";
import { SITE_DESCRIPTION, siteUrl } from "@/lib/site";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-outfit",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-fraunces",
  axes: ["opsz"],
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
      className={`${outfit.variable} ${fraunces.variable} h-full`}
    >
      <body className="flex min-h-full flex-col antialiased">
        <a className="skip-link" href="#content">
          Skip to content
        </a>
        <Header />
        <main
          id="content"
          tabIndex={-1}
          className="mx-auto w-full max-w-6xl flex-1 px-5 py-10 md:px-10 md:py-14"
        >
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
