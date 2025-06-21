export const metadata = {
  title: 'Head Ball Game',
  description: 'A fun football game built with Phaser and Next.js',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <script src="https://cdn.jsdelivr.net/npm/phaser@3.80.0/dist/phaser.min.js"></script>
      </head>
      <body>
        {children}
      </body>
    </html>
  )
} 