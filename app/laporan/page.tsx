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
      const { data: jadwalData, error: jadwalError } = await supabase
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

      if (jadwalError) {
        console.log("FETCH JADWAL LAPORAN ERROR:", jadwalError)
      }

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
        .order("created_at", { ascending: true })

      if (jadwal?.tanggal_mulai) {
        aktivitasQuery = aktivitasQuery.gte("tanggal", jadwal.tanggal_mulai)
      }

      const { data: aktivitasData, error: aktivitasError } =
        await aktivitasQuery

      if (aktivitasError) {
        console.log("FETCH AKTIVITAS LAPORAN ERROR:", aktivitasError)
      }

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
    setDownloadingId(item.panen.id)

    try {
      const { default: jsPDF } = await import("jspdf")

      const pdf = new jsPDF("p", "mm", "a4")

      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()

      const margin = 14
      const contentWidth = pageWidth - margin * 2

      let y = 16

      const bagiHasil = getBagiHasil(item)

      const addPageIfNeeded = (heightNeeded = 10) => {
        if (y + heightNeeded > pageHeight - margin) {
          pdf.addPage()
          y = margin
        }
      }

      const addText = (
        text: string,
        x: number,
        fontSize = 10,
        fontStyle: "normal" | "bold" = "normal",
        maxWidth = contentWidth
      ) => {
        pdf.setFont("helvetica", fontStyle)
        pdf.setFontSize(fontSize)
        pdf.setTextColor(0, 0, 0)

        const lines = pdf.splitTextToSize(text || "-", maxWidth)
        pdf.text(lines, x, y)
        y += lines.length * (fontSize * 0.38) + 2
      }

      const addSectionTitle = (title: string) => {
        addPageIfNeeded(12)
        y += 4
        pdf.setFont("helvetica", "bold")
        pdf.setFontSize(14)
        pdf.setTextColor(0, 0, 0)
        pdf.text(title, margin, y)
        y += 8
      }

      const addInfoBox = (
        label: string,
        value: string,
        x: number,
        boxY: number,
        width: number
      ) => {
        pdf.setDrawColor(220, 220, 220)
        pdf.roundedRect(x, boxY, width, 17, 2, 2)

        pdf.setFont("helvetica", "normal")
        pdf.setFontSize(8)
        pdf.setTextColor(100, 100, 100)
        pdf.text(label, x + 3, boxY + 6)

        pdf.setFont("helvetica", "bold")
        pdf.setFontSize(10)
        pdf.setTextColor(0, 0, 0)

        const valueLines = pdf.splitTextToSize(value || "-", width - 6)
        pdf.text(valueLines, x + 3, boxY + 12)
      }

      const addTwoColumnInfo = (
        leftLabel: string,
        leftValue: string,
        rightLabel: string,
        rightValue: string
      ) => {
        addPageIfNeeded(22)

        const gap = 6
        const boxWidth = (contentWidth - gap) / 2
        const boxY = y

        addInfoBox(leftLabel, leftValue, margin, boxY, boxWidth)
        addInfoBox(rightLabel, rightValue, margin + boxWidth + gap, boxY, boxWidth)

        y += 22
      }

      pdf.setTextColor(0, 120, 60)
      pdf.setFont("helvetica", "bold")
      pdf.setFontSize(10)
      pdf.text("RiceShare", margin, y)
      y += 8

      pdf.setTextColor(0, 0, 0)
      pdf.setFontSize(20)
      pdf.text("Laporan Musim Tanam", margin, y)
      y += 8

      pdf.setFont("helvetica", "normal")
      pdf.setFontSize(10)
      pdf.setTextColor(90, 90, 90)
      pdf.text(
        `${item.panen.lahan?.lokasi || "Lahan tidak diketahui"} • ${getPeriodeLaporan(item)}`,
        margin,
        y
      )
      y += 8

      pdf.setDrawColor(22, 163, 74)
      pdf.setLineWidth(0.8)
      pdf.line(margin, y, pageWidth - margin, y)
      y += 8

      pdf.setTextColor(0, 0, 0)

      addTwoColumnInfo(
        "Lahan",
        item.panen.lahan?.lokasi || "-",
        "Luas Lahan",
        `${item.panen.lahan?.luas || "-"} m²`
      )

      addTwoColumnInfo(
        "Periode",
        getPeriodeLaporan(item),
        "Varietas",
        item.jadwal?.varietas_padi || "-"
      )

      addTwoColumnInfo(
        "Jumlah Benih",
        `${formatKg(item.jadwal?.jumlah_benih)} kg`,
        "Tanggal Panen",
        formatDateId(item.panen.tanggal)
      )

      addTwoColumnInfo(
        "Total GKP",
        `${formatKg(item.panen.berat_gkp)} kg`,
        "Estimasi Beras",
        `${formatKg(bagiHasil?.total_beras)} kg`
      )

      addTwoColumnInfo(
        "Bagian Pemilik",
        `${formatKg(bagiHasil?.porsi_pemilik)} kg`,
        "Bagian Pengelola",
        `${formatKg(bagiHasil?.porsi_pengelola)} kg`
      )

      addSectionTitle("Catatan Panen")
      addPageIfNeeded(20)

      const catatan = item.panen.catatan || "Tidak ada catatan."
      const catatanLines = pdf.splitTextToSize(catatan, contentWidth - 6)
      const catatanBoxHeight = Math.max(18, catatanLines.length * 5 + 8)

      pdf.setDrawColor(220, 220, 220)
      pdf.roundedRect(margin, y, contentWidth, catatanBoxHeight, 2, 2)

      pdf.setFont("helvetica", "normal")
      pdf.setFontSize(10)
      pdf.setTextColor(0, 0, 0)
      pdf.text(catatanLines, margin + 3, y + 7)

      y += catatanBoxHeight + 4

      addSectionTitle("Aktivitas Musim Tanam")

      if (item.aktivitas.length === 0) {
        addText("Belum ada aktivitas tercatat.", margin, 10)
      } else {
        const colTanggal = 34
        const colAktivitas = 48
        const colDeskripsi = contentWidth - colTanggal - colAktivitas

        const drawTableHeader = () => {
          addPageIfNeeded(12)

          pdf.setFillColor(245, 245, 245)
          pdf.rect(margin, y, contentWidth, 8, "F")

          pdf.setDrawColor(220, 220, 220)
          pdf.rect(margin, y, contentWidth, 8)

          pdf.setFont("helvetica", "bold")
          pdf.setFontSize(9)
          pdf.setTextColor(0, 0, 0)

          pdf.text("Tanggal", margin + 2, y + 5)
          pdf.text("Aktivitas", margin + colTanggal + 2, y + 5)
          pdf.text("Deskripsi", margin + colTanggal + colAktivitas + 2, y + 5)

          y += 8
        }

        drawTableHeader()

        item.aktivitas.forEach((log) => {
          const tanggalText = formatDateId(log.tanggal)
          const aktivitasText = log.jenis_aktivitas || "-"
          const deskripsiText = log.deskripsi || "-"

          pdf.setFont("helvetica", "normal")
          pdf.setFontSize(8)
          pdf.setTextColor(0, 0, 0)

          const tanggalLines = pdf.splitTextToSize(tanggalText, colTanggal - 4)
          const aktivitasLines = pdf.splitTextToSize(
            aktivitasText,
            colAktivitas - 4
          )
          const deskripsiLines = pdf.splitTextToSize(
            deskripsiText,
            colDeskripsi - 4
          )

          const maxLines = Math.max(
            tanggalLines.length,
            aktivitasLines.length,
            deskripsiLines.length
          )

          const rowHeight = Math.max(9, maxLines * 4 + 4)

          if (y + rowHeight > pageHeight - margin) {
            pdf.addPage()
            y = margin
            drawTableHeader()
          }

          pdf.setDrawColor(220, 220, 220)
          pdf.rect(margin, y, contentWidth, rowHeight)

          pdf.text(tanggalLines, margin + 2, y + 5)
          pdf.text(aktivitasLines, margin + colTanggal + 2, y + 5)
          pdf.text(
            deskripsiLines,
            margin + colTanggal + colAktivitas + 2,
            y + 5
          )

          y += rowHeight
        })
      }

      const totalPages = pdf.getNumberOfPages()

      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i)
        pdf.setFont("helvetica", "normal")
        pdf.setFontSize(8)
        pdf.setTextColor(120, 120, 120)

        pdf.text("Dicetak dari RiceShare", margin, pageHeight - 8)
        pdf.text(`${i}/${totalPages}`, pageWidth - margin - 8, pageHeight - 8)
      }

      const lokasi = sanitizeFileName(item.panen.lahan?.lokasi || "lahan")
      const tanggal = item.panen.tanggal

      pdf.save(`laporan-${lokasi}-${tanggal}.pdf`)
    } catch (error) {
      console.log("DOWNLOAD PDF ERROR:", error)
      alert("Gagal mengunduh PDF. Cek console browser.")
    } finally {
      setDownloadingId(null)
    }
  }

  if (checkingUser) {
    return (
      <main className="min-h-screen bg-gray-50 p-6 text-gray-900">
        Loading...
      </main>
    )
  }

  if (!user) return null

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900">
      <div className="mx-auto w-full max-w-6xl px-4 py-4 md:px-6 md:py-6">
        <header className="mb-6 flex flex-col gap-4 rounded-2xl border bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium text-green-700">RiceShare</p>
            <h1 className="text-2xl font-bold">Laporan</h1>
            <p className="text-sm text-gray-500">
              Ringkasan musim tanam, aktivitas, hasil panen, dan bagi hasil.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              onClick={fetchLaporan}
              className="rounded-xl border px-4 py-2 text-sm font-medium hover:bg-gray-50"
            >
              Refresh
            </button>

            <button
              onClick={() => router.push("/dashboard")}
              className="rounded-xl border px-4 py-2 text-sm font-medium hover:bg-gray-50"
            >
              Dashboard
            </button>
          </div>
        </header>

        <section className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-5">
          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <p className="text-sm text-gray-500">Total Laporan</p>
            <h2 className="mt-2 text-2xl font-bold">{summary.totalLaporan}</h2>
          </div>

          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <p className="text-sm text-gray-500">Total GKP</p>
            <h2 className="mt-2 text-2xl font-bold">
              {formatKg(summary.totalGkp)} kg
            </h2>
          </div>

          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <p className="text-sm text-gray-500">Estimasi Beras</p>
            <h2 className="mt-2 text-2xl font-bold">
              {formatKg(summary.totalBeras)} kg
            </h2>
          </div>

          <div className="rounded-2xl border bg-blue-50 p-4 shadow-sm">
            <p className="text-sm text-blue-700">Bagian Pemilik</p>
            <h2 className="mt-2 text-2xl font-bold text-blue-800">
              {formatKg(summary.totalPemilik)} kg
            </h2>
          </div>

          <div className="rounded-2xl border bg-yellow-50 p-4 shadow-sm">
            <p className="text-sm text-yellow-700">Bagian Pengelola</p>
            <h2 className="mt-2 text-2xl font-bold text-yellow-800">
              {formatKg(summary.totalPengelola)} kg
            </h2>
          </div>
        </section>

        {loadingData ? (
          <section className="rounded-2xl border bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">Memuat laporan...</p>
          </section>
        ) : laporanList.length === 0 ? (
          <section className="rounded-2xl border bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">
              Belum ada laporan karena belum ada data panen.
            </p>
          </section>
        ) : (
          <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {laporanList.map((item) => {
              const bagiHasil = getBagiHasil(item)

              return (
                <article
                  key={item.panen.id}
                  className="rounded-2xl border bg-white p-5 shadow-sm"
                >
                  <div className="mb-4">
                    <h2 className="text-xl font-bold">
                      {item.panen.lahan?.lokasi || "Lahan tidak diketahui"}
                    </h2>

                    <p className="text-sm text-gray-500">
                      {getPeriodeLaporan(item)}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="rounded-xl bg-gray-50 p-3">
                      <p className="text-sm text-gray-500">Varietas</p>
                      <p className="font-bold">
                        {item.jadwal?.varietas_padi || "-"}
                      </p>
                    </div>

                    <div className="rounded-xl bg-gray-50 p-3">
                      <p className="text-sm text-gray-500">Total GKP</p>
                      <p className="font-bold">
                        {formatKg(item.panen.berat_gkp)} kg
                      </p>
                    </div>

                    <div className="rounded-xl bg-blue-50 p-3">
                      <p className="text-sm text-blue-700">Bagian Pemilik</p>
                      <p className="font-bold text-blue-800">
                        {formatKg(bagiHasil?.porsi_pemilik)} kg
                      </p>
                    </div>

                    <div className="rounded-xl bg-yellow-50 p-3">
                      <p className="text-sm text-yellow-700">
                        Bagian Pengelola
                      </p>
                      <p className="font-bold text-yellow-800">
                        {formatKg(bagiHasil?.porsi_pengelola)} kg
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                    <button
                      onClick={() => setSelectedLaporan(item)}
                      className="w-full rounded-xl border px-4 py-2 text-sm font-medium hover:bg-gray-50 sm:w-1/2"
                    >
                      Lihat Overview
                    </button>

                    <button
                      onClick={() => handleDownloadPdf(item)}
                      disabled={downloadingId === item.panen.id}
                      className="w-full rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60 sm:w-1/2"
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

      {selectedLaporan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-medium text-green-700">
                  Overview Laporan
                </p>

                <h2 className="text-xl font-bold">
                  {selectedLaporan.panen.lahan?.lokasi ||
                    "Lahan tidak diketahui"}
                </h2>

                <p className="text-sm text-gray-500">
                  {getPeriodeLaporan(selectedLaporan)}
                </p>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  onClick={() => handleDownloadPdf(selectedLaporan)}
                  disabled={downloadingId === selectedLaporan.panen.id}
                  className="rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60"
                >
                  {downloadingId === selectedLaporan.panen.id
                    ? "Mengunduh..."
                    : "Download PDF"}
                </button>

                <button
                  onClick={() => setSelectedLaporan(null)}
                  className="rounded-xl border px-4 py-2 text-sm font-medium hover:bg-gray-50"
                >
                  Tutup
                </button>
              </div>
            </div>

            <div className="bg-white p-6 text-gray-900">
              <div className="border-b-4 border-green-600 pb-4">
                <p className="text-sm font-medium text-green-700">RiceShare</p>
                <h1 className="text-3xl font-bold">Laporan Musim Tanam</h1>
                <p className="mt-1 text-sm text-gray-600">
                  {selectedLaporan.panen.lahan?.lokasi ||
                    "Lahan tidak diketahui"}{" "}
                  • {getPeriodeLaporan(selectedLaporan)}
                </p>
              </div>

              <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="rounded-xl border p-4">
                  <p className="text-sm text-gray-500">Lahan</p>
                  <p className="font-bold">
                    {selectedLaporan.panen.lahan?.lokasi || "-"}
                  </p>
                </div>

                <div className="rounded-xl border p-4">
                  <p className="text-sm text-gray-500">Luas Lahan</p>
                  <p className="font-bold">
                    {selectedLaporan.panen.lahan?.luas || "-"} m²
                  </p>
                </div>

                <div className="rounded-xl border p-4">
                  <p className="text-sm text-gray-500">Periode</p>
                  <p className="font-bold">
                    {getPeriodeLaporan(selectedLaporan)}
                  </p>
                </div>

                <div className="rounded-xl border p-4">
                  <p className="text-sm text-gray-500">Varietas</p>
                  <p className="font-bold">
                    {selectedLaporan.jadwal?.varietas_padi || "-"}
                  </p>
                </div>

                <div className="rounded-xl border p-4">
                  <p className="text-sm text-gray-500">Jumlah Benih</p>
                  <p className="font-bold">
                    {formatKg(selectedLaporan.jadwal?.jumlah_benih)} kg
                  </p>
                </div>

                <div className="rounded-xl border p-4">
                  <p className="text-sm text-gray-500">Tanggal Panen</p>
                  <p className="font-bold">
                    {formatDateId(selectedLaporan.panen.tanggal)}
                  </p>
                </div>

                <div className="rounded-xl border p-4">
                  <p className="text-sm text-gray-500">Total GKP</p>
                  <p className="font-bold">
                    {formatKg(selectedLaporan.panen.berat_gkp)} kg
                  </p>
                </div>

                <div className="rounded-xl border p-4">
                  <p className="text-sm text-gray-500">Estimasi Beras</p>
                  <p className="font-bold">
                    {formatKg(getBagiHasil(selectedLaporan)?.total_beras)} kg
                  </p>
                </div>

                <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                  <p className="text-sm text-blue-700">Bagian Pemilik</p>
                  <p className="font-bold text-blue-800">
                    {formatKg(getBagiHasil(selectedLaporan)?.porsi_pemilik)} kg
                  </p>
                </div>

                <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4">
                  <p className="text-sm text-yellow-700">Bagian Pengelola</p>
                  <p className="font-bold text-yellow-800">
                    {formatKg(getBagiHasil(selectedLaporan)?.porsi_pengelola)} kg
                  </p>
                </div>
              </div>

              <div className="mt-6">
                <h2 className="mb-2 text-xl font-bold">Catatan Panen</h2>
                <div className="rounded-xl border p-4">
                  <p className="whitespace-pre-line text-sm">
                    {selectedLaporan.panen.catatan || "Tidak ada catatan."}
                  </p>
                </div>
              </div>

              <div className="mt-6">
                <h2 className="mb-2 text-xl font-bold">
                  Aktivitas Musim Tanam
                </h2>

                {selectedLaporan.aktivitas.length === 0 ? (
                  <div className="rounded-xl border p-4 text-sm text-gray-500">
                    Belum ada aktivitas tercatat.
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-xl border">
                    <table className="w-full border-collapse text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="border-b p-3 text-left">Tanggal</th>
                          <th className="border-b p-3 text-left">Aktivitas</th>
                          <th className="border-b p-3 text-left">Deskripsi</th>
                        </tr>
                      </thead>

                      <tbody>
                        {selectedLaporan.aktivitas.map((log) => (
                          <tr key={log.id}>
                            <td className="border-b p-3 align-top">
                              {formatDateId(log.tanggal)}
                            </td>
                            <td className="border-b p-3 align-top font-medium">
                              {log.jenis_aktivitas}
                            </td>
                            <td className="border-b p-3 align-top">
                              {log.deskripsi || "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {selectedLaporan.panen.bukti_url && (
                <div className="mt-6">
                  <h2 className="mb-2 text-xl font-bold">Bukti Panen</h2>

                  <div className="rounded-xl border p-4">
                    <img
                      src={selectedLaporan.panen.bukti_url}
                      alt="Bukti panen"
                      className="max-h-[360px] w-full rounded-xl object-contain"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  )
}