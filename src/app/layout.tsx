import ContextProvider from "../../context"
import Script from "next/script"

export const metadata = {
  title: 'Head Ball Game',
  description: 'A fun football game built with Phaser and Next.js',
}

import { ReactNode } from "react";

export default function RootLayout({ children }: { children: ReactNode }) {
  // You may want to get cookies from document.cookie or another source
  const cookies = typeof document !== "undefined" ? document.cookie : null;

  return (
    <html lang="en">
      <head>
        {/* Phaser script loaded with Next.js Script component */}
        <Script
          src="https://cdn.jsdelivr.net/npm/phaser@3.80.0/dist/phaser.min.js"
          strategy="beforeInteractive"
        />
      </head>
      <body>
      <ContextProvider cookies={cookies}>
        {children}
      </ContextProvider>
      </body>
    </html>
  )
} 