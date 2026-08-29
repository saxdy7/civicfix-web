import type { Metadata } from "next";
import { Instrument_Serif, Inter } from "next/font/google";

import { SmoothScroll } from "@/components/SmoothScroll";

import "./globals.css";

const instrumentSerif = Instrument_Serif({
  variable: "--font-serif-accent",
  subsets: ["latin"],
  weight: "400",
  style: ["italic", "normal"],
});

// next/font self-hosts the font at build time (no runtime request to Google,
// no manual preconnect/<link> needed) and fixes the
// @next/next/no-page-custom-font lint warning the old <link> tag triggered.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "CivicFix — Report it. Track it. Get it fixed.",
  description:
    "AI-assisted civic issue reporting and resolution platform with transparent triage, department routing, field evidence, and public status tracking.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${instrumentSerif.variable} ${inter.variable}`}>
      <head>
        {/* Retro dot-matrix display face used by the landing hero. */}
        <link
          href="https://db.onlinewebfonts.com/c/8cb707a9b8a73f8a7403336b861c3074?family=BubbledotICG-FinePos"
          rel="stylesheet"
        />
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css"
          integrity="sha512-SnH5WK+bZxgPHs44uWIX+LLJAJ9/2PkPKZ5QiAj6Ta86w+fsb2TkcmfRyVX3pBnMFcV7oQPJkl9QevSCWr3W6A=="
          crossOrigin="anonymous"
          referrerPolicy="no-referrer"
        />
      </head>
      <body>
        <SmoothScroll />
        {children}
      </body>
    </html>
  );
}
