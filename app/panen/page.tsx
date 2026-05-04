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

  // ambil data lahan
  useEffect(() => {
    const fetchLahan = async () => {
      const { data, error } = await supabase.from("lahan").select("*")
      if (error) {
        console.error(error)
        alert("Gagal mengambil data lahan")
      } else {
        setLahanList(data || [])
      }
    }

    fetchLahan()
  }, [])

  const handleSubmit = async (e: any) => {
  e.preventDefault()

  if (!lahanId || !berat || !tanggal) {
    alert("Semua field harus diisi!")
    return
  }

  if (parseFloat(berat) <= 0) {
    alert("Berat harus lebih dari 0")
    return
  }

  setLoading(true)

  try {
    // 1. simpan panen
    const { data: panen, error: panenError } = await supabase
      .from("panen")
      .insert([
        {
          lahan_id: lahanId,
          berat_gkp: parseFloat(berat),
          tanggal
        }
      ])
      .select()

    if (panenError) throw panenError

    const panen_id = panen[0].id

    // 2. hitung
    const total_beras = parseFloat(berat) * 0.65
    const porsi_pemilik = total_beras * 0.5
    const porsi_pengelola = total_beras * 0.5

    // 🔥 3. simpan bagi hasil (FIX DI SINI)
    const { error: bagiError } = await supabase
      .from("bagi_hasil")
      .insert([
        {
          panen_id,
          total_beras,
          porsi_pemilik,
          porsi_pengelola
        }
      ])

    if (bagiError) {
      alert("Error bagi hasil: " + bagiError.message)
      console.log(bagiError)
      return
    }

    // 4. tampilkan hasil
    setResult({
      total_beras,
      porsi_pemilik,
      porsi_pengelola
    })

    // reset form
    setLahanId("")
    setBerat("")
    setTanggal("")
  } catch (err: any) {
    alert("Terjadi error: " + err.message)
  } finally {
    setLoading(false)
  }
}

  return (
    <div style={{ padding: 20 }}>
      <h1>Input Panen</h1>

      <form onSubmit={handleSubmit}>
        
        <select value={lahanId} onChange={(e) => setLahanId(e.target.value)}>
          <option value="">Pilih Lahan</option>
          {lahanList.map((lahan) => (
            <option key={lahan.id} value={lahan.id}>
              {lahan.lokasi} - {lahan.luas} m²
            </option>
          ))}
        </select>

        <br />

        <input
          type="number"
          placeholder="Berat GKP"
          value={berat}
          onChange={(e) => setBerat(e.target.value)}
        />

        <br />

        <input
          type="date"
          value={tanggal}
          onChange={(e) => setTanggal(e.target.value)}
        />

        <br />

        <button type="submit" disabled={loading}>
          {loading ? "Menyimpan..." : "Simpan"}
        </button>
      </form>

      {result && (
        <div style={{ marginTop: 20 }}>
          <h2>Hasil</h2>
          <p>Total Beras: {result?.total_beras?.toFixed(2)}</p>
          <p>Pemilik: {result?.porsi_pemilik?.toFixed(2)}</p>
          <p>Pengelola: {result?.porsi_pengelola?.toFixed(2)}</p>
        </div>
      )}
    </div>
  )
}