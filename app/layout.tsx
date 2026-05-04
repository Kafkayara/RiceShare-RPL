// @ts-ignore
import "./globals.css"
import Link from "next/link"

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body style={{ background: "#0f0f0f", color: "white", margin: 0 }}>
        
        {/* 🔥 NAVBAR */}
        <nav style={navbar}>
          <h2 style={{ margin: 0 }}>🌾 RiceShare</h2>

          <div style={{ display: "flex", gap: 20 }}>
            <Link href="/">Home</Link>
            <Link href="/panen">Input Panen</Link>
            <Link href="/dashboard">Dashboard</Link>
          </div>
        </nav>

        {/* 🔥 CONTENT */}
        <main style={{ padding: 20 }}>
          {children}
        </main>

      </body>
    </html>
  )
}

const navbar = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "15px 30px",
  borderBottom: "1px solid #333",
  background: "#111",
}