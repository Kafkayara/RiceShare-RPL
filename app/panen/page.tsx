"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"

export default function PanenPage() {
  const [lahanId, setLahanId] = useState("")
  const [berat, setBerat] = useState("")
  const [tanggal, setTanggal] = useState("")
  const [result, setResult] = useState<any>(null)
  const [lahanList, setLahanList] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const fetchLahan = async () => {
      const { data } = await supabase.from("lahan").select("*")
      setLahanList(data || [])
    }
    fetchLahan()
  }, [])

  const handleSubmit = async (e: any) => {
    e.preventDefault()

    if (!lahanId || !berat || !tanggal) {
      alert("Semua field harus diisi!")
      return
    }

    setLoading(true)

    const { data: panen } = await supabase
      .from("panen")
      .insert([
        {
          lahan_id: lahanId,
          berat_gkp: parseFloat(berat),
          tanggal
        }
      ])
      .select()

    const panen_id = panen?.[0]?.id

    const total_beras = parseFloat(berat) * 0.65
    const porsi = total_beras * 0.5

    await supabase.from("bagi_hasil").insert([
      {
        panen_id,
        total_beras,
        porsi_pemilik: porsi,
        porsi_pengelola: porsi
      }
    ])

    setResult({ total_beras, porsi })

    setLahanId("")
    setBerat("")
    setTanggal("")
    setLoading(false)
  }

  return (
    <div className="flex justify-center mt-10">
      <div className="bg-gray-900 p-6 rounded-xl w-full max-w-md shadow-lg">

        <h1 className="text-xl font-bold mb-4">🌾 Input Panen</h1>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">

          <select
            className="bg-gray-800 p-2 rounded text-white"
            value={lahanId}
            onChange={(e) => setLahanId(e.target.value)}
          >
            <option value="">Pilih Lahan</option>
            {lahanList.map((lahan) => (
              <option key={lahan.id} value={lahan.id}>
                {lahan.lokasi} - {lahan.luas} m²
              </option>
            ))}
          </select>

          <input
            type="number"
            placeholder="Berat GKP"
            className="bg-gray-800 p-2 rounded text-white"
            value={berat}
            onChange={(e) => setBerat(e.target.value)}
          />

          <input
            type="date"
            className="bg-gray-800 p-2 rounded text-white"
            value={tanggal}
            onChange={(e) => setTanggal(e.target.value)}
          />

          <button
            type="submit"
            disabled={loading}
            className="bg-green-500 hover:bg-green-600 p-2 rounded font-semibold"
          >
            {loading ? "Menyimpan..." : "Simpan"}
          </button>
        </form>

        {result && (
          <div className="mt-6 bg-gray-800 p-4 rounded">
            <h2 className="font-bold mb-2">Hasil</h2>
            <p>🍚 Total Beras: {result.total_beras.toFixed(2)}</p>
            <p>👤 Pemilik: {result.porsi.toFixed(2)}</p>
            <p>🧑‍🌾 Pengelola: {result.porsi.toFixed(2)}</p>
          </div>
        )}
      </div>
    </div>
  )
}