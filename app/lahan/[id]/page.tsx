"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
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
  catatan?: string | null
  created_at?: string | null
}

type LahanDetail = {
  id: string
  lokasi: string
  luas: number
  status: string
  jadwal_tanam?: JadwalTanam[]
}

type TimelineItem = {
  label: string
  range: string
  tanggal: string
  status: "selesai" | "berjalan" | "belum"
}

function addDays(dateString: string, days: number) {
  const date = new Date(dateString)
  date.setDate(date.getDate() + days)

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")

  return `${year}-${month}-${day}`
}

function differenceInDays(startDate: string, endDate: string) {
  const start = new Date(startDate)
  const end = new Date(endDate)

  start.setHours(0, 0, 0, 0)
  end.setHours(0, 0, 0, 0)

  const diff = end.getTime() - start.getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}

function getTodayDateInputValue() {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, "0")
  const day = String(today.getDate()).padStart(2, "0")

  return `${year}-${month}-${day}`
}

function formatDateId(dateString?: string | null) {
  if (!dateString) return "-"

  return new Date(dateString).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

function formatNumber(value?: number | null) {
  if (value === null || value === undefined) return "-"

  return new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)
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
    tanam: "Tanam",
  }

  return label[status] || status
}

function getStatusStyle(status?: string | null) {
  switch (status) {
    case "masa_tanam_aktif":
    case "tanam":
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

function getTimelineStatus(
  hariKe: number | null,
  startDay: number,
  endDay: number
): "selesai" | "berjalan" | "belum" {
  if (hariKe === null) return "belum"

  if (hariKe > endDay) return "selesai"
  if (hariKe >= startDay && hariKe <= endDay) return "berjalan"

  return "belum"
}

function getSingleDayTimelineStatus(
  hariKe: number | null,
  day: number
): "selesai" | "berjalan" | "belum" {
  if (hariKe === null) return "belum"

  if (hariKe > day) return "selesai"
  if (hariKe === day) return "berjalan"

  return "belum"
}

function buildTimeline(tanggalMulai: string, hariKe: number | null): TimelineItem[] {
  return [
    {
      label: "Pindah Tanam",
      range: "H0",
      tanggal: formatDateId(tanggalMulai),
      status: getSingleDayTimelineStatus(hariKe, 0),
    },
    {
      label: "Cek Adaptasi Bibit",
      range: "H1–H7",
      tanggal: `${formatDateId(addDays(tanggalMulai, 1))} – ${formatDateId(
        addDays(tanggalMulai, 7)
      )}`,
      status: getTimelineStatus(hariKe, 1, 7),
    },
    {
      label: "Pupuk Awal",
      range: "H7–H14",
      tanggal: `${formatDateId(addDays(tanggalMulai, 7))} – ${formatDateId(
        addDays(tanggalMulai, 14)
      )}`,
      status: getTimelineStatus(hariKe, 7, 14),
    },
    {
      label: "Pantau Pertumbuhan Awal",
      range: "H14–H21",
      tanggal: `${formatDateId(addDays(tanggalMulai, 14))} – ${formatDateId(
        addDays(tanggalMulai, 21)
      )}`,
      status: getTimelineStatus(hariKe, 14, 21),
    },
    {
      label: "Persiapan Pengendalian Gulma",
      range: "H21–H30",
      tanggal: `${formatDateId(addDays(tanggalMulai, 21))} – ${formatDateId(
        addDays(tanggalMulai, 30)
      )}`,
      status: getTimelineStatus(hariKe, 21, 30),
    },
    {
      label: "Bersihkan Gulma",
      range: "H30",
      tanggal: formatDateId(addDays(tanggalMulai, 30)),
      status: getSingleDayTimelineStatus(hariKe, 30),
    },
    {
      label: "Pupuk Lanjutan",
      range: "H35–H40",
      tanggal: `${formatDateId(addDays(tanggalMulai, 35))} – ${formatDateId(
        addDays(tanggalMulai, 40)
      )}`,
      status: getTimelineStatus(hariKe, 35, 40),
    },
    {
      label: "Perawatan Lanjutan",
      range: "H40–H60",
      tanggal: `${formatDateId(addDays(tanggalMulai, 40))} – ${formatDateId(
        addDays(tanggalMulai, 60)
      )}`,
      status: getTimelineStatus(hariKe, 40, 60),
    },
    {
      label: "Pengawasan Generatif",
      range: "H60",
      tanggal: formatDateId(addDays(tanggalMulai, 60)),
      status: getSingleDayTimelineStatus(hariKe, 60),
    },
    {
      label: "Menjelang Panen",
      range: "H70–H85",
      tanggal: `${formatDateId(addDays(tanggalMulai, 70))} – ${formatDateId(
        addDays(tanggalMulai, 85)
      )}`,
      status: getTimelineStatus(hariKe, 70, 85),
    },
    {
      label: "Periode Panen",
      range: "H80–H105",
      tanggal: `${formatDateId(addDays(tanggalMulai, 80))} – ${formatDateId(
        addDays(tanggalMulai, 105)
      )}`,
      status: getTimelineStatus(hariKe, 80, 105),
    },
    {
      label: "Masa Istirahat",
      range: "H106–H119",
      tanggal: `${formatDateId(addDays(tanggalMulai, 106))} – ${formatDateId(
        addDays(tanggalMulai, 119)
      )}`,
      status: getTimelineStatus(hariKe, 106, 119),
    },
    {
      label: "Siap Tanam Kembali",
      range: "H120+",
      tanggal: `Mulai ${formatDateId(addDays(tanggalMulai, 120))}`,
      status: hariKe !== null && hariKe >= 120 ? "berjalan" : "belum",
    },
  ]
}

function getCurrentStage(hariKe: number | null) {
  if (hariKe === null) return "Belum ada siklus tanam aktif"

  if (hariKe < 0) return "Belum dimulai"
  if (hariKe === 0) return "Pindah Tanam"
  if (hariKe <= 7) return "Cek Adaptasi Bibit"
  if (hariKe <= 14) return "Pupuk Awal"
  if (hariKe <= 21) return "Pantau Pertumbuhan Awal"
  if (hariKe <= 30) return "Persiapan / Pembersihan Gulma"
  if (hariKe <= 40) return "Pupuk Lanjutan"
  if (hariKe <= 60) return "Perawatan Lanjutan"
  if (hariKe <= 69) return "Pengawasan Generatif"
  if (hariKe <= 79) return "Menjelang Panen"
  if (hariKe <= 105) return "Periode Panen"
  if (hariKe <= 119) return "Masa Istirahat"
  return "Siap Tanam Kembali"
}

function getTimelineBadgeStyle(status: TimelineItem["status"]) {
  switch (status) {
    case "selesai":
      return "bg-green-100 text-green-700"
    case "berjalan":
      return "bg-yellow-100 text-yellow-700"
    case "belum":
      return "bg-gray-100 text-gray-600"
    default:
      return "bg-gray-100 text-gray-600"
  }
}

function getTimelineLabel(status: TimelineItem["status"]) {
  switch (status) {
    case "selesai":
      return "Selesai"
    case "berjalan":
      return "Berjalan"
    case "belum":
      return "Belum"
    default:
      return "-"
  }
}

export default function DetailLahanPage() {
  const router = useRouter()
  const params = useParams()
  const lahanId = params.id as string

  const [user, setUser] = useState<UserProfile | null>(null)
  const [checkingUser, setCheckingUser] = useState(true)
  const [loadingData, setLoadingData] = useState(true)
  const [lahan, setLahan] = useState<LahanDetail | null>(null)

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
    const fetchLahanDetail = async () => {
      setLoadingData(true)

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
            jumlah_benih,
            catatan,
            created_at
          )
        `)
        .eq("id", lahanId)
        .single()

      if (error) {
        console.log("FETCH DETAIL LAHAN ERROR:", error)
        setLahan(null)
        setLoadingData(false)
        return
      }

      setLahan(data)
      setLoadingData(false)
    }

    if (lahanId) {
      fetchLahanDetail()
    }
  }, [lahanId])

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

  const jadwalTerbaru = lahan?.jadwal_tanam?.[0]

  const today = getTodayDateInputValue()

  const hariKe =
    jadwalTerbaru?.tanggal_mulai &&
    ["masa_tanam_aktif", "menjelang_panen", "panen_selesai", "istirahat", "siap_tanam_kembali"].includes(
      lahan?.status || ""
    )
      ? differenceInDays(jadwalTerbaru.tanggal_mulai, today)
      : null

  const tahapSekarang = getCurrentStage(hariKe)

  const panenMulai = jadwalTerbaru?.tanggal_mulai
    ? addDays(jadwalTerbaru.tanggal_mulai, 80)
    : null

  const panenSelesai = jadwalTerbaru?.tanggal_mulai
    ? addDays(jadwalTerbaru.tanggal_mulai, 105)
    : null

  const siapTanamKembali = jadwalTerbaru?.tanggal_mulai
    ? addDays(jadwalTerbaru.tanggal_mulai, 120)
    : null

  const estimasiGabahMin = jadwalTerbaru?.jumlah_benih
    ? jadwalTerbaru.jumlah_benih * 150
    : null

  const estimasiGabahAman = jadwalTerbaru?.jumlah_benih
    ? jadwalTerbaru.jumlah_benih * 200
    : null

  const estimasiGabahMax = jadwalTerbaru?.jumlah_benih
    ? jadwalTerbaru.jumlah_benih * 250
    : null

  const timeline = jadwalTerbaru?.tanggal_mulai
    ? buildTimeline(jadwalTerbaru.tanggal_mulai, hariKe)
    : []

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900">
      <div className="mx-auto w-full max-w-6xl px-4 py-4 md:px-6 md:py-6">
        <header className="mb-6 flex flex-col gap-4 rounded-2xl border bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium text-green-700">RiceShare</p>
            <h1 className="text-2xl font-bold">Detail Lahan</h1>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              onClick={() => router.push("/lahan")}
              className="rounded-xl border px-4 py-2 text-sm font-medium hover:bg-gray-50"
            >
              Kembali
            </button>

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
            <p className="text-sm text-gray-500">Memuat detail lahan...</p>
          </section>
        ) : !lahan ? (
          <section className="rounded-2xl border bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">
              Data lahan tidak ditemukan.
            </p>
          </section>
        ) : (
          <>
            <section className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-2xl border bg-white p-5 shadow-sm">
                <p className="text-sm text-gray-500">Lokasi Lahan</p>
                <h2 className="mt-2 text-2xl font-bold">{lahan.lokasi}</h2>
              </div>

              <div className="rounded-2xl border bg-white p-5 shadow-sm">
                <p className="text-sm text-gray-500">Luas</p>
                <h2 className="mt-2 text-2xl font-bold">{lahan.luas} m²</h2>
              </div>

              <div className="rounded-2xl border bg-white p-5 shadow-sm">
                <p className="text-sm text-gray-500">Status</p>
                <span
                  className={`mt-3 inline-block rounded-full border px-3 py-1 text-sm font-medium ${getStatusStyle(
                    lahan.status
                  )}`}
                >
                  {formatStatus(lahan.status)}
                </span>
              </div>
            </section>

            <section className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className="rounded-2xl border bg-white p-5 shadow-sm">
                <h2 className="mb-4 text-lg font-bold">Siklus Tanam</h2>

                {jadwalTerbaru ? (
                  <div className="space-y-3 text-sm">
                    <div className="rounded-xl bg-gray-50 p-3">
                      <p className="text-gray-500">Hari Ke</p>
                      <p className="font-semibold">
                        {hariKe !== null ? `H${hariKe}` : "-"}
                      </p>
                    </div>

                    <div className="rounded-xl bg-gray-50 p-3">
                      <p className="text-gray-500">Tahap Sekarang</p>
                      <p className="font-semibold">{tahapSekarang}</p>
                    </div>

                    <div className="rounded-xl bg-gray-50 p-3">
                      <p className="text-gray-500">Tanggal Pindah Tanam</p>
                      <p className="font-semibold">
                        {formatDateId(jadwalTerbaru.tanggal_mulai)}
                      </p>
                    </div>

                    <div className="rounded-xl bg-gray-50 p-3">
                      <p className="text-gray-500">Estimasi Panen</p>
                      <p className="font-semibold">
                        {panenMulai && panenSelesai
                          ? `${formatDateId(panenMulai)} – ${formatDateId(
                              panenSelesai
                            )}`
                          : "-"}
                      </p>
                    </div>

                    <div className="rounded-xl bg-gray-50 p-3">
                      <p className="text-gray-500">Siap Tanam Kembali</p>
                      <p className="font-semibold">
                        {formatDateId(siapTanamKembali)}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="rounded-xl bg-gray-50 p-4 text-sm text-gray-500">
                    Belum ada siklus tanam untuk lahan ini.
                  </p>
                )}
              </div>

              <div className="rounded-2xl border bg-white p-5 shadow-sm">
                <h2 className="mb-4 text-lg font-bold">Data Tanam</h2>

                {jadwalTerbaru ? (
                  <div className="space-y-3 text-sm">
                    <div className="rounded-xl bg-gray-50 p-3">
                      <p className="text-gray-500">Varietas Padi</p>
                      <p className="font-semibold">
                        {jadwalTerbaru.varietas_padi || "-"}
                      </p>
                    </div>

                    <div className="rounded-xl bg-gray-50 p-3">
                      <p className="text-gray-500">Jumlah Benih</p>
                      <p className="font-semibold">
                        {formatNumber(jadwalTerbaru.jumlah_benih)} kg
                      </p>
                    </div>

                    <div className="rounded-xl border border-green-100 bg-green-50 p-3">
                      <p className="text-green-700">Estimasi Hasil Gabah</p>
                      {estimasiGabahMin &&
                      estimasiGabahAman &&
                      estimasiGabahMax ? (
                        <>
                          <p className="font-bold text-green-900">
                            {formatNumber(estimasiGabahMin)} –{" "}
                            {formatNumber(estimasiGabahMax)} kg
                          </p>
                          <p className="text-sm text-green-700">
                            Patokan aman: ±{formatNumber(estimasiGabahAman)} kg
                          </p>
                        </>
                      ) : (
                        <p className="font-semibold text-green-900">-</p>
                      )}
                    </div>

                    <div className="rounded-xl bg-gray-50 p-3">
                      <p className="text-gray-500">Catatan Awal</p>
                      <p className="font-semibold">
                        {jadwalTerbaru.catatan || "-"}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="rounded-xl bg-gray-50 p-4 text-sm text-gray-500">
                    Belum ada data tanam.
                  </p>
                )}
              </div>
            </section>

            <section className="rounded-2xl border bg-white p-5 shadow-sm">
              <div className="mb-4">
                <h2 className="text-lg font-bold">Timeline Siklus Tanam</h2>
                <p className="text-sm text-gray-500">
                  Timeline dihitung otomatis dari tanggal pindah tanam / H0.
                </p>
              </div>

              {timeline.length === 0 ? (
                <p className="rounded-xl bg-gray-50 p-4 text-sm text-gray-500">
                  Timeline belum tersedia karena lahan belum memiliki data
                  mulai tanam.
                </p>
              ) : (
                <div className="space-y-3">
                  {timeline.map((item) => (
                    <div
                      key={`${item.range}-${item.label}`}
                      className="rounded-2xl border bg-gray-50 p-4"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="font-semibold">{item.label}</p>
                          <p className="text-sm text-gray-500">
                            {item.tanggal}
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-gray-700">
                            {item.range}
                          </span>

                          <span
                            className={`rounded-full px-3 py-1 text-xs font-medium ${getTimelineBadgeStyle(
                              item.status
                            )}`}
                          >
                            {getTimelineLabel(item.status)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  )
}