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
      <main className="min-h-screen bg-gradient-to-br from-green-50 via-lime-50 to-emerald-100 p-6">
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
    <main className="min-h-screen bg-gradient-to-br from-green-50 via-lime-50 to-emerald-100 text-gray-900">
      <div className="mx-auto w-full max-w-7xl px-4 py-5 md:px-6 md:py-7">

        <header className="relative overflow-hidden rounded-[32px] border border-green-100 bg-white/90 p-6 shadow-[0_10px_40px_rgba(0,0,0,0.06)] backdrop-blur">
          
          

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

      {/* ── MODAL OVERVIEW LAPORAN ───────────────────────────────────────── */}
      {selectedLaporan && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm">
          <div className="relative my-8 w-full max-w-3xl rounded-[32px] bg-white shadow-2xl">

            {/* Header modal */}
            <div className="flex items-start justify-between border-b p-6">
              <div>
                <p className="text-sm font-medium text-green-700">Overview Laporan</p>
                <h2 className="mt-1 text-2xl font-black">
                  {selectedLaporan.panen.lahan?.lokasi || "Lahan"}
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  {getPeriodeLaporan(selectedLaporan)}
                </p>
              </div>
              <button
                onClick={() => setSelectedLaporan(null)}
                className="flex h-10 w-10 items-center justify-center rounded-2xl bg-red-50 text-red-500 hover:bg-red-100"
              >
                ✕
              </button>
            </div>

            <div className="space-y-6 p-6">

              {/* ── Info Lahan ── */}
              <section>
                <h3 className="mb-3 font-bold text-gray-700">📋 Informasi Lahan</h3>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {[
                    { label: "Lokasi",    value: selectedLaporan.panen.lahan?.lokasi || "-" },
                    { label: "Luas",      value: selectedLaporan.panen.lahan?.luas ? `${selectedLaporan.panen.lahan.luas} ha` : "-" },
                    { label: "Varietas",  value: selectedLaporan.jadwal?.varietas_padi || "-" },
                    { label: "Mulai Tanam", value: formatDateId(selectedLaporan.jadwal?.tanggal_mulai) },
                    { label: "Tanggal Panen", value: formatDateId(selectedLaporan.panen.tanggal) },
                    { label: "Jumlah Benih", value: selectedLaporan.jadwal?.jumlah_benih ? `${selectedLaporan.jadwal.jumlah_benih} kg` : "-" },
                  ].map((row) => (
                    <div key={row.label} className="rounded-2xl bg-gray-50 p-3">
                      <p className="text-xs text-gray-500">{row.label}</p>
                      <p className="mt-0.5 font-bold text-gray-800">{row.value}</p>
                    </div>
                  ))}
                </div>
              </section>

              {/* ── Hasil Panen & Bagi Hasil ── */}
              <section>
                <h3 className="mb-3 font-bold text-gray-700">🌾 Hasil Panen & Bagi Hasil</h3>
                {(() => {
                  const bh = getBagiHasil(selectedLaporan)
                  return (
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <div className="rounded-2xl bg-green-50 p-4">
                        <p className="text-xs text-green-700">Total GKP</p>
                        <p className="mt-1 text-xl font-black text-green-900">
                          {formatKg(selectedLaporan.panen.berat_gkp)} kg
                        </p>
                      </div>
                      <div className="rounded-2xl bg-emerald-50 p-4">
                        <p className="text-xs text-emerald-700">Total Beras</p>
                        <p className="mt-1 text-xl font-black text-emerald-900">
                          {formatKg(bh?.total_beras)} kg
                        </p>
                      </div>
                      <div className="rounded-2xl bg-blue-50 p-4">
                        <p className="text-xs text-blue-700">Bagian Pemilik</p>
                        <p className="mt-1 text-xl font-black text-blue-900">
                          {formatKg(bh?.porsi_pemilik)} kg
                        </p>
                      </div>
                      <div className="rounded-2xl bg-amber-50 p-4">
                        <p className="text-xs text-amber-700">Bagian Pengelola</p>
                        <p className="mt-1 text-xl font-black text-amber-900">
                          {formatKg(bh?.porsi_pengelola)} kg
                        </p>
                      </div>
                    </div>
                  )
                })()}

                {selectedLaporan.panen.catatan && (
                  <div className="mt-3 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                    <p className="text-xs text-gray-500">Catatan Panen</p>
                    <p className="mt-1 text-sm text-gray-700">{selectedLaporan.panen.catatan}</p>
                  </div>
                )}
              </section>

              {/* ── Riwayat Aktivitas ── */}
              <section>
                <h3 className="mb-3 font-bold text-gray-700">
                  📝 Riwayat Aktivitas
                  <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">
                    {selectedLaporan.aktivitas.length} aktivitas
                  </span>
                </h3>

                {selectedLaporan.aktivitas.length === 0 ? (
                  <div className="rounded-2xl bg-gray-50 p-5 text-center text-sm text-gray-500">
                    Tidak ada log aktivitas untuk periode ini.
                  </div>
                ) : (
                  <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                    {selectedLaporan.aktivitas.map((log) => (
                      <div
                        key={log.id}
                        className="flex items-start gap-3 rounded-2xl border border-gray-100 bg-gray-50 p-3"
                      >
                        <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-green-500" />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-gray-800 text-sm">
                              {log.jenis_aktivitas}
                            </span>
                            <span className="text-xs text-gray-400">
                              {formatDateId(log.tanggal)}
                            </span>
                          </div>
                          {log.deskripsi && (
                            <p className="mt-0.5 text-xs text-gray-500 line-clamp-2">
                              {log.deskripsi}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>

            {/* Footer modal */}
            <div className="flex justify-end gap-3 border-t p-6">
              <button
                onClick={() => setSelectedLaporan(null)}
                className="rounded-2xl border px-5 py-2.5 text-sm font-semibold hover:bg-gray-50"
              >
                Tutup
              </button>
              <button
                onClick={() => handleDownloadPdf(selectedLaporan)}
                className="rounded-2xl bg-gradient-to-r from-green-600 to-emerald-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg hover:-translate-y-0.5 transition-all"
              >
                Download PDF
              </button>
            </div>
          </div>
        </div>
      )}

    </main>
  )
}