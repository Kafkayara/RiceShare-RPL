"use client"

import { syncLahanStatus } from "@/lib/syncLahanStatus"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

type UserProfile = {
  id: string
  nama: string
  email: string
  role: "pemilik" | "pengelola"
}

type JadwalTanam = {
  id: string
  tanggal_mulai: string
  tanggal_selesai: string
  status: string
  varietas_padi?: string | null
  jumlah_benih?: number | null
}

type LahanItem = {
  id: string
  lokasi: string
  luas: number
  status: string
  jadwal_tanam?: JadwalTanam[]
}

function formatDateId(dateString?: string | null) {
  if (!dateString) return "-"

  return new Date(dateString).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

function formatStatus(status?: string | null) {
  if (!status) return "Tidak diketahui"

  const label: Record<string, string> = {
    belum_digunakan: "Belum Digunakan",
    masa_tanam_aktif: "Masa Tanam Aktif",
    menjelang_panen: "Menjelang Panen",
    panen_selesai: "Panen Selesai",
    istirahat: "Istirahat",
    siap_tanam_kembali: "Siap Tanam Kembali",
  }

  return label[status] || status
}

function getStatusStyle(status?: string | null) {
  switch (status) {
    case "masa_tanam_aktif":
      return "bg-green-100 text-green-700 border-green-200"
    case "menjelang_panen":
      return "bg-yellow-100 text-yellow-700 border-yellow-200"
    case "panen_selesai":
      return "bg-blue-100 text-blue-700 border-blue-200"
    case "istirahat":
      return "bg-gray-100 text-gray-700 border-gray-200"
    case "siap_tanam_kembali":
      return "bg-emerald-100 text-emerald-700 border-emerald-200"
    case "belum_digunakan":
      return "bg-slate-100 text-slate-700 border-slate-200"
    default:
      return "bg-gray-100 text-gray-700 border-gray-200"
  }
}

function addDays(dateString: string, days: number) {
  const date = new Date(dateString)
  date.setDate(date.getDate() + days)

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")

  return `${year}-${month}-${day}`
}

export default function LahanPage() {
  const router = useRouter()

  const [user, setUser] = useState<UserProfile | null>(null)
  const [checkingUser, setCheckingUser] = useState(true)
  const [lahanList, setLahanList] = useState<LahanItem[]>([])
  const [loadingData, setLoadingData] = useState(true)

  useEffect(() => {
    const savedUser = localStorage.getItem("riceshare_user")

    if (!savedUser) {
      router.push("/")
      return
    }

    setUser(JSON.parse(savedUser))
    setCheckingUser(false)
  }, [router])

  useEffect(() => {
    const fetchLahan = async () => {
      setLoadingData(true)

      await syncLahanStatus()

      const { data, error } = await supabase
        .from("lahan")
        .select(`
          id,
          lokasi,
          luas,
          status,
          jadwal_tanam (
            id,
            tanggal_mulai,
            tanggal_selesai,
            status,
            varietas_padi,
            jumlah_benih
          )
        `)
        .order("lokasi", { ascending: true })

      if (error) {
        console.log("FETCH LAHAN ERROR:", error)
        setLoadingData(false)
        return
      }

      setLahanList(data || [])
      setLoadingData(false)
    }

    fetchLahan()
  }, [])

  if (checkingUser) {
    return (
      <main className="min-h-screen bg-gray-50 p-6 text-gray-900">
        Loading...
      </main>
    )
  }

  if (!user) {
    return null
  }

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900">
      <div className="mx-auto w-full max-w-6xl px-4 py-4 md:px-6 md:py-6">
        <header className="mb-6 flex flex-col gap-4 rounded-2xl border bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium text-green-700">RiceShare</p>
            <h1 className="text-2xl font-bold">Status Lahan</h1>
            <p className="text-sm text-gray-500">
              Pantau kondisi lahan, status tanam, dan estimasi panen.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              onClick={() => router.push("/dashboard")}
              className="rounded-xl border px-4 py-2 text-sm font-medium hover:bg-gray-50"
            >
              Dashboard
            </button>
          </div>
        </header>

        {loadingData ? (
          <section className="rounded-2xl border bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">Memuat data lahan...</p>
          </section>
        ) : lahanList.length === 0 ? (
          <section className="rounded-2xl border bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">
              Belum ada data lahan.
            </p>
          </section>
        ) : (
          <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {lahanList.map((lahan) => {
              const jadwalTerbaru = lahan.jadwal_tanam?.[0]

              const estimasiPanenMulai = jadwalTerbaru?.tanggal_mulai
                ? addDays(jadwalTerbaru.tanggal_mulai, 80)
                : null

              const estimasiPanenSelesai = jadwalTerbaru?.tanggal_selesai

              return (
                <article
                  key={lahan.id}
                  className="rounded-2xl border bg-white p-5 shadow-sm"
                >
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-bold">
                        Lahan {lahan.lokasi}
                      </h2>
                      <p className="text-sm text-gray-500">
                        Luas: {lahan.luas} m²
                      </p>
                    </div>

                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-medium ${getStatusStyle(
                        lahan.status
                      )}`}
                    >
                      {formatStatus(lahan.status)}
                    </span>
                  </div>

                  <div className="space-y-3 text-sm">
                    <div className="rounded-xl bg-gray-50 p-3">
                      <p className="text-gray-500">Tanggal Pindah Tanam</p>
                      <p className="font-semibold">
                        {formatDateId(jadwalTerbaru?.tanggal_mulai)}
                      </p>
                    </div>

                    <div className="rounded-xl bg-gray-50 p-3">
                      <p className="text-gray-500">Estimasi Panen</p>
                      <p className="font-semibold">
                        {estimasiPanenMulai && estimasiPanenSelesai
                          ? `${formatDateId(estimasiPanenMulai)} – ${formatDateId(
                              estimasiPanenSelesai
                            )}`
                          : "-"}
                      </p>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="rounded-xl bg-gray-50 p-3">
                        <p className="text-gray-500">Varietas</p>
                        <p className="font-semibold">
                          {jadwalTerbaru?.varietas_padi || "-"}
                        </p>
                      </div>

                      <div className="rounded-xl bg-gray-50 p-3">
                        <p className="text-gray-500">Jumlah Benih</p>
                        <p className="font-semibold">
                          {jadwalTerbaru?.jumlah_benih
                            ? `${jadwalTerbaru.jumlah_benih} kg`
                            : "-"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                    <button
                      onClick={() => router.push(`/lahan/${lahan.id}`)}
                      className="w-full rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 sm:w-1/2"
                    >
                      Lihat Detail
                    </button>

                    <button
                      onClick={() => router.push(`/log/tambah?lahan_id=${lahan.id}`)}
                      className="rounded-xl border px-4 py-2 font-medium hover:bg-gray-50"
                    >
                      Log Aktivitas
                    </button>
                  </div>
                </article>
              )
            })}
          </section>
        )}
      </div>
    </main>
  )
}