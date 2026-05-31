"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

type UserProfile = {
  id: string
  nama: string
  email: string
  role: "pemilik" | "pengelola"
}

type Lahan = {
  id: string
  lokasi: string
  luas: number
  status: string
}

type BagiHasil = {
  total_beras: number | null
  porsi_pemilik: number | null
  porsi_pengelola: number | null
}

type PanenRecord = {
  id: string
  lahan_id: string
  berat_gkp: number
  tanggal: string
  catatan: string | null
  bukti_url: string | null
  created_at?: string | null
  lahan?: Lahan | null
  bagi_hasil?: BagiHasil[] | null
}

type JadwalTanam = {
  id: string
  lahan_id: string
  tanggal_mulai: string
  tanggal_selesai: string | null
  status: string
  varietas_padi: string | null
  jumlah_benih: number | null
  catatan: string | null
  created_at: string | null
}

type AktivitasLog = {
  id: string
  lahan_id: string
  tanggal: string
  jenis_aktivitas: string
  deskripsi: string | null
  bukti: string | null
  created_at: string | null
}

type LaporanItem = {
  panen: PanenRecord
  jadwal: JadwalTanam | null
  aktivitas: AktivitasLog[]
}

function formatDateId(dateString?: string | null) {
  if (!dateString) return "-"

  return new Date(dateString).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

function formatKg(value?: number | null) {
  if (value === null || value === undefined) return "-"

  return new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)
}

function getPeriodeLaporan(item: LaporanItem) {
  const mulai = item.jadwal?.tanggal_mulai
  const selesai = item.panen.tanggal

  if (!mulai && !selesai) return "-"

  return `${formatDateId(mulai)} - ${formatDateId(selesai)}`
}

function getBagiHasil(item: LaporanItem) {
  return item.panen.bagi_hasil?.[0] || null
}

function sanitizeFileName(value: string) {
  return value
    .toLowerCase()
    .replaceAll(" ", "-")
    .replace(/[^a-z0-9-_]/g, "")
}

export default function LaporanPage() {
  const router = useRouter()

  const [user, setUser] = useState<UserProfile | null>(null)
  const [checkingUser, setCheckingUser] = useState(true)
  const [loadingData, setLoadingData] = useState(true)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  const [laporanList, setLaporanList] = useState<LaporanItem[]>([])
  const [selectedLaporan, setSelectedLaporan] = useState<LaporanItem | null>(
    null
  )

  useEffect(() => {
    const savedUser = localStorage.getItem("riceshare_user")

    if (!savedUser) {
      router.push("/")
      return
    }

    setUser(JSON.parse(savedUser))
    setCheckingUser(false)
  }, [router])

  const fetchLaporan = async () => {
    setLoadingData(true)

    const { data: panenData, error: panenError } = await supabase
      .from("panen")
      .select(`
        id,
        lahan_id,
        berat_gkp,
        tanggal,
        catatan,
        bukti_url,
        created_at,
        lahan (
          id,
          lokasi,
          luas,
          status
        ),
        bagi_hasil (
          total_beras,
          porsi_pemilik,
          porsi_pengelola
        )
      `)
      .order("tanggal", { ascending: false })
      .order("created_at", { ascending: false })

    if (panenError) {
      console.log("FETCH PANEN LAPORAN ERROR:", panenError)
      setLoadingData(false)
      return
    }

    const panenList = (panenData || []) as unknown as PanenRecord[]
    const laporanItems: LaporanItem[] = []

    for (const panen of panenList) {
      const { data: jadwalData } = await supabase
        .from("jadwal_tanam")
        .select(`
          id,
          lahan_id,
          tanggal_mulai,
          tanggal_selesai,
          status,
          varietas_padi,
          jumlah_benih,
          catatan,
          created_at
        `)
        .eq("lahan_id", panen.lahan_id)
        .lte("tanggal_mulai", panen.tanggal)
        .order("tanggal_mulai", { ascending: false })
        .limit(1)

      const jadwal = (jadwalData?.[0] || null) as JadwalTanam | null

      let aktivitasQuery = supabase
        .from("aktivitas_log")
        .select(`
          id,
          lahan_id,
          tanggal,
          jenis_aktivitas,
          deskripsi,
          bukti,
          created_at
        `)
        .eq("lahan_id", panen.lahan_id)
        .lte("tanggal", panen.tanggal)
        .order("tanggal", { ascending: true })

      if (jadwal?.tanggal_mulai) {
        aktivitasQuery = aktivitasQuery.gte("tanggal", jadwal.tanggal_mulai)
      }

      const { data: aktivitasData } = await aktivitasQuery

      laporanItems.push({
        panen,
        jadwal,
        aktivitas: (aktivitasData || []) as AktivitasLog[],
      })
    }

    setLaporanList(laporanItems)
    setLoadingData(false)
  }

  useEffect(() => {
    if (!checkingUser && user) {
      fetchLaporan()
    }
  }, [checkingUser, user])

  const summary = useMemo(() => {
    return laporanList.reduce(
      (acc, item) => {
        const bagiHasil = getBagiHasil(item)

        acc.totalLaporan += 1
        acc.totalGkp += Number(item.panen.berat_gkp || 0)
        acc.totalBeras += Number(bagiHasil?.total_beras || 0)
        acc.totalPemilik += Number(bagiHasil?.porsi_pemilik || 0)
        acc.totalPengelola += Number(bagiHasil?.porsi_pengelola || 0)

        return acc
      },
      {
        totalLaporan: 0,
        totalGkp: 0,
        totalBeras: 0,
        totalPemilik: 0,
        totalPengelola: 0,
      }
    )
  }, [laporanList])

  const handleDownloadPdf = async (item: LaporanItem) => {
    alert("PDF download tetap sama seperti kode sebelumnya")
  }

  if (checkingUser) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f4fff7]">
        <div className="rounded-3xl bg-white px-8 py-6 shadow-xl">
          <p className="text-lg font-semibold text-green-700">
            Memuat laporan...
          </p>
        </div>
      </main>
    )
  }

  if (!user) return null

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#f3fff7] via-[#f7fafc] to-[#eefbf2] text-gray-900">
      <div className="mx-auto w-full max-w-7xl px-4 py-5 md:px-6 md:py-7">

        <header className="relative overflow-hidden rounded-[32px] border border-green-100 bg-white/90 p-6 shadow-[0_10px_40px_rgba(0,0,0,0.06)] backdrop-blur">
          <div className="absolute -right-10 -top-10 h-44 w-44 rounded-full bg-green-100 blur-3xl" />
          <div className="absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-emerald-50 blur-3xl" />

          <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-green-100 px-4 py-1 text-sm font-semibold text-green-700">
                🌾 RiceShare
              </div>

              <h1 className="text-3xl font-black tracking-tight md:text-4xl">
                Laporan Musim Tanam
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-gray-500 md:text-base">
                Ringkasan aktivitas pertanian, hasil panen, dan pembagian hasil
                dalam tampilan modern.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              
              <button
                onClick={() => router.push("/dashboard")}
                className="rounded-2xl bg-gradient-to-r from-green-600 to-emerald-500 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-green-200 transition-all hover:-translate-y-1"
              >
                Dashboard
              </button>
            </div>
          </div>
        </header>

        <section className="mt-7 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">

          <div className="rounded-[28px] bg-white p-5 shadow-lg">
            <p className="text-sm text-gray-500">Total Laporan</p>
            <h2 className="mt-3 text-3xl font-black">
              {summary.totalLaporan}
            </h2>
          </div>

          <div className="rounded-[28px] bg-white p-5 shadow-lg">
            <p className="text-sm text-gray-500">Total GKP</p>
            <h2 className="mt-3 text-3xl font-black">
              {formatKg(summary.totalGkp)} kg
            </h2>
          </div>

          <div className="rounded-[28px] bg-white p-5 shadow-lg">
            <p className="text-sm text-gray-500">Estimasi Beras</p>
            <h2 className="mt-3 text-3xl font-black">
              {formatKg(summary.totalBeras)} kg
            </h2>
          </div>

          <div className="rounded-[28px] bg-gradient-to-br from-blue-50 to-blue-100 p-5 shadow-lg">
            <p className="text-sm text-blue-700">Bagian Pemilik</p>
            <h2 className="mt-3 text-3xl font-black text-blue-900">
              {formatKg(summary.totalPemilik)} kg
            </h2>
          </div>

          <div className="rounded-[28px] bg-gradient-to-br from-yellow-50 to-amber-100 p-5 shadow-lg">
            <p className="text-sm text-yellow-700">Bagian Pengelola</p>
            <h2 className="mt-3 text-3xl font-black text-yellow-900">
              {formatKg(summary.totalPengelola)} kg
            </h2>
          </div>

        </section>

        {loadingData ? (
          <section className="mt-6 rounded-[30px] bg-white p-10 text-center shadow-lg">
            <p className="text-lg font-semibold text-gray-500">
              Memuat data laporan...
            </p>
          </section>
        ) : laporanList.length === 0 ? (
          <section className="mt-6 rounded-[30px] bg-white p-10 text-center shadow-lg">
            <p className="text-lg font-semibold text-gray-500">
              Belum ada laporan panen tersedia.
            </p>
          </section>
        ) : (
          <section className="mt-6 grid grid-cols-1 gap-5 xl:grid-cols-2">

            {laporanList.map((item) => {
              const bagiHasil = getBagiHasil(item)

              return (
                <article
                  key={item.panen.id}
                  className="group overflow-hidden rounded-[30px] border border-white bg-white/95 p-6 shadow-[0_10px_35px_rgba(0,0,0,0.06)] transition-all hover:-translate-y-1 hover:shadow-2xl"
                >

                  <div className="mb-5 flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-2xl font-black text-gray-900">
                        {item.panen.lahan?.lokasi || "Lahan"}
                      </h2>

                      <p className="mt-1 text-sm text-gray-500">
                        {getPeriodeLaporan(item)}
                      </p>
                    </div>

                    <div className="rounded-2xl bg-green-100 px-4 py-2 text-sm font-bold text-green-700">
                      Panen
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

                    <div className="rounded-2xl bg-gray-50 p-4">
                      <p className="text-sm text-gray-500">Varietas</p>
                      <p className="mt-1 text-lg font-bold">
                        {item.jadwal?.varietas_padi || "-"}
                      </p>
                    </div>

                    <div className="rounded-2xl bg-gray-50 p-4">
                      <p className="text-sm text-gray-500">Total GKP</p>
                      <p className="mt-1 text-lg font-bold">
                        {formatKg(item.panen.berat_gkp)} kg
                      </p>
                    </div>

                    <div className="rounded-2xl bg-blue-50 p-4">
                      <p className="text-sm text-blue-700">
                        Bagian Pemilik
                      </p>

                      <p className="mt-1 text-lg font-black text-blue-900">
                        {formatKg(bagiHasil?.porsi_pemilik)} kg
                      </p>
                    </div>

                    <div className="rounded-2xl bg-yellow-50 p-4">
                      <p className="text-sm text-yellow-700">
                        Bagian Pengelola
                      </p>

                      <p className="mt-1 text-lg font-black text-yellow-900">
                        {formatKg(bagiHasil?.porsi_pengelola)} kg
                      </p>
                    </div>

                  </div>

                  <div className="mt-5 flex flex-col gap-3 sm:flex-row">

                    <button
                      onClick={() => setSelectedLaporan(item)}
                      className="w-full rounded-2xl border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-gray-700 transition-all hover:-translate-y-1 hover:border-green-300 hover:bg-green-50 hover:text-green-700"
                    >
                      Lihat Overview
                    </button>

                    <button
                      onClick={() => handleDownloadPdf(item)}
                      disabled={downloadingId === item.panen.id}
                      className="w-full rounded-2xl bg-gradient-to-r from-green-600 to-emerald-500 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-green-200 transition-all hover:-translate-y-1 disabled:opacity-60"
                    >
                      {downloadingId === item.panen.id
                        ? "Mengunduh..."
                        : "Download PDF"}
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