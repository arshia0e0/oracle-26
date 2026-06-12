import type { Metadata } from "next";
import Nav from "@/components/Nav";
import RevealFx from "@/components/RevealFx";
import Ticker from "@/components/Ticker";
import { FieldBg, Footer, PitchMarks } from "@/components/OracleChrome";
import "./globals.css";

export const metadata: Metadata = {
  title: "ORACLE — World Cup 2026 AI Prediction League",
  description:
    "The beautiful game, computed. Five AI models predict every FIFA World Cup 2026 match — exact score, every time. See who calls it best.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Anton&family=Archivo:wght@400;500;600;700&family=Space+Mono:wght@400;700&family=Stardos+Stencil:wght@400;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <FieldBg />
        <PitchMarks />
        <Ticker />
        <Nav />
        <RevealFx />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
