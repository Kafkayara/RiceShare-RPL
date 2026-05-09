// @ts-ignore
import "./globals.css"

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
<<<<<<< HEAD
    <html lang="en">
      <body style={{ background: "#0f0f0f", color: "white", margin: 0 }}>
        
        {/* 🔥 NAVBAR */}
        <nav style={navbar}>
          <h2 style={{ margin: 0 }}>🌾 RiceShare</h2>

          <div style={{ display: "flex", gap: 20 }}>
            <Link href="/panen">Input Panen</Link>
            <Link href="/dashboard">Dashboard</Link>
          </div>
        </nav>

        {/* 🔥 CONTENT */}
        <main style={{ padding: 20 }}>
          {children}
        </main>

=======
    <html lang="id">
      <body>
        {children}
>>>>>>> 7049ddb (Update app pages)
      </body>
    </html>
  )
}