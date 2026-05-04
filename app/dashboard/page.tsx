"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"

export default function DashboardPage() {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = async () => {
    const { data, error } = await supabase
      .from("panen")
      .select(`
        id,
        tanggal,
        berat_gkp,
        lahan (lokasi),
        bagi_hasil (
          total_beras,
          porsi_pemilik,
          porsi_pengelola
        )
      `)
      .order("tanggal", { ascending: false })

    if (!error) {
      setData(data || [])
    }

    setLoading(false)
  }

  useEffect(() => {
    fetchData()

    // 🔥 realtime update
    const channel = supabase
      .channel("realtime panen")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "panen" },
        () => {
          fetchData()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const totalPanen = data.length
  const totalBeras = data.reduce(
    (sum, item) => sum + (item.bagi_hasil?.[0]?.total_beras || 0),
    0
  )

  if (loading) {
    return <div className="p-6">Loading...</div>
  }

  return (
    <div className="p-6">

      <h1 className="text-2xl font-bold mb-6">📊 Dashboard Panen</h1>

      {/* STAT CARD */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-gray-900 p-4 rounded-xl shadow">
          <p className="text-gray-400">Total Panen</p>
          <h2 className="text-2xl font-bold">{totalPanen}</h2>
        </div>

        <div className="bg-gray-900 p-4 rounded-xl shadow">
          <p className="text-gray-400">Total Beras</p>
          <h2 className="text-2xl font-bold">
            {new Intl.NumberFormat("id-ID").format(totalBeras)}
          </h2>
        </div>
      </div>

      {/* LIST */}
      <div className="flex flex-col gap-4">
        {data.map((item) => {
          const hasil = item.bagi_hasil?.[0]

          return (
            <div key={item.id} className="bg-gray-900 p-5 rounded-xl shadow">
              
              <h3 className="text-lg font-semibold">
                🌾 {item.lahan?.lokasi}
              </h3>

              <p className="text-gray-400">
                📅 {new Date(item.tanggal).toLocaleDateString("id-ID")}
              </p>

              <p className="text-gray-400 mb-2">
                ⚖️ GKP: {item.berat_gkp}
              </p>

              <div className="border-t border-gray-700 my-2"></div>

              {hasil ? (
                <>
                  <p>🍚 Total Beras: {hasil.total_beras}</p>
                  <p>👤 Pemilik: {hasil.porsi_pemilik}</p>
                  <p>🧑‍🌾 Pengelola: {hasil.porsi_pengelola}</p>
                </>
              ) : (
                <p className="text-red-400">Belum ada bagi hasil</p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}