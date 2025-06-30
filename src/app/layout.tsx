import ContextProvider from "../../context";
import Script from "next/script";
import "./globals.css";

export const metadata = {
  title: "MetaHead Arena",
  description: "A fun football game built with Phaser and Next.js",
};

import { ReactNode } from "react";

export default function RootLayout({ children }: { children: ReactNode }) {
  // You may want to get cookies from document.cookie or another source
  const cookies = typeof document !== "undefined" ? document.cookie : null;

  return (
    <html lang="en">
      <head>
        {/* Favicon */}
        <link rel="icon" href="/logo.png" type="image/x-icon" />
        {/* Preload critical fonts to prevent FOUC */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap"
          rel="stylesheet"
        />
        {/* Phaser script loaded with Next.js Script component */}
        <Script
          src="https://cdn.jsdelivr.net/npm/phaser@3.80.0/dist/phaser.min.js"
          strategy="beforeInteractive"
        />
      </head>
      <body suppressHydrationWarning={true}>
        <ContextProvider cookies={cookies}>{children}</ContextProvider>
      </body>
    </html>
  );
}
