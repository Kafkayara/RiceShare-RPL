import { supabase } from "@/lib/supabase"

function formatTanggal(tgl: string) {
  return new Date(tgl).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  })
}

function formatAngka(num?: number) {
  if (!num && num !== 0) return "-"
  return num.toFixed(2)
}

export default async function DashboardPage() {
  const { data, error } = await supabase
    .from("panen")
    .select(`
      id,
      tanggal,
      berat_gkp,
      lahan (
        lokasi
      ),
      bagi_hasil (
        total_beras,
        porsi_pemilik,
        porsi_pengelola
      )
    `)
    .order("tanggal", { ascending: false })

  if (error) {
    return <div style={{ padding: 20 }}>Error: {error.message}</div>
  }

  // 🔥 hitung summary
  const totalPanen = data?.length || 0
  const totalBeras = data?.reduce(
    (acc: number, item: any) =>
      acc + (item.bagi_hasil?.[0]?.total_beras || 0),
    0
  )

  return (
    <div style={{ padding: 20 }}>
      <h1 style={{ fontSize: 28, marginBottom: 20 }}>📊 Dashboard Panen</h1>

      {/* 🔥 SUMMARY */}
      <div style={{ display: "flex", gap: 20, marginBottom: 30 }}>
        <div style={cardStyle}>
          <h3>Total Panen</h3>
          <p style={bigText}>{totalPanen}</p>
        </div>

        <div style={cardStyle}>
          <h3>Total Beras</h3>
          <p style={bigText}>{formatAngka(totalBeras)}</p>
        </div>
      </div>

      {/* 🔥 LIST DATA */}
      <div>
        {data && data.length > 0 ? (
          data.map((item: any) => (
            <div key={item.id} style={itemCard}>
              <h3 style={{ marginBottom: 8 }}>
                🌾 {item.lahan?.lokasi || "-"}
              </h3>

              <p>📅 {formatTanggal(item.tanggal)}</p>
              <p>⚖️ GKP: {item.berat_gkp}</p>

              <hr style={{ margin: "10px 0" }} />

              <p>🍚 Total Beras: {formatAngka(item.bagi_hasil?.[0]?.total_beras)}</p>
              <p>👤 Pemilik: {formatAngka(item.bagi_hasil?.[0]?.porsi_pemilik)}</p>
              <p>🧑‍🌾 Pengelola: {formatAngka(item.bagi_hasil?.[0]?.porsi_pengelola)}</p>
            </div>
          ))
        ) : (
          <p>Belum ada data panen.</p>
        )}
      </div>
    </div>
  )
}

/* 🔥 STYLE SEDERHANA */
const cardStyle = {
  border: "1px solid #444",
  padding: 20,
  borderRadius: 10,
  width: 200,
  background: "#111",
}

const itemCard = {
  border: "1px solid #333",
  padding: 15,
  borderRadius: 10,
  marginBottom: 15,
  background: "#0f0f0f",
}

const bigText = {
  fontSize: 24,
  fontWeight: "bold",
}