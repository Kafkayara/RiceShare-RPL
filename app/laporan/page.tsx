"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import RiceShareTopNav from "@/components/RiceShareTopNav"
import { Download, Eye, Filter, FileText, X } from "lucide-react"

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

function sanitizePdfText(value: string) {
  return value
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[^\x20-\x7E\n]/g, "")
}

function escapePdfText(value: string) {
  return sanitizePdfText(value)
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
}

function downloadSimplePdf(fileName: string, lines: string[]) {
  const pageWidth = 595
  const pageHeight = 842
  const marginX = 48
  const lineHeight = 16
  const fontSize = 11
  const titleFontSize = 18

  const sanitizedLines = lines.flatMap((line) => {
    const safeLine = sanitizePdfText(line)
    const maxChars = 82

    if (safeLine.length <= maxChars) return [safeLine]

    const chunks: string[] = []
    let rest = safeLine

    while (rest.length > maxChars) {
      const slice = rest.slice(0, maxChars)
      const lastSpace = slice.lastIndexOf(" ")
      const cutAt = lastSpace > 30 ? lastSpace : maxChars

      chunks.push(rest.slice(0, cutAt))
      rest = rest.slice(cutAt).trim()
    }

    if (rest) chunks.push(rest)

    return chunks
  })

  const maxLinesPerPage = Math.floor((pageHeight - 110) / lineHeight)
  const pages: string[][] = []

  for (let i = 0; i < sanitizedLines.length; i += maxLinesPerPage) {
    pages.push(sanitizedLines.slice(i, i + maxLinesPerPage))
  }

  if (pages.length === 0) pages.push(["Tidak ada data laporan."])

  const objects: string[] = []
  const pageObjectNumbers: number[] = []

  objects.push("<< /Type /Catalog /Pages 2 0 R >>")
  objects.push("<< /Type /Pages /Kids [] /Count 0 >>")
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>")

  pages.forEach((pageLines, pageIndex) => {
    const contentObjectNumber = objects.length + 2
    const pageObjectNumber = objects.length + 1

    pageObjectNumbers.push(pageObjectNumber)

    const commands: string[] = [
      "BT",
      `/F2 ${titleFontSize} Tf`,
      `${marginX} ${pageHeight - 56} Td`,
      `(Laporan Musim Tanam RiceShare) Tj`,
      `/F1 ${fontSize} Tf`,
      `0 -28 Td`,
    ]

    pageLines.forEach((line, index) => {
      if (index > 0) commands.push(`0 -${lineHeight} Td`)
      commands.push(`(${escapePdfText(line)}) Tj`)
    })

    commands.push("ET")

    const content = commands.join("\n")

    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentObjectNumber} 0 R >>`
    )
    objects.push(
      `<< /Length ${content.length} >>\nstream\n${content}\nendstream`
    )
  })

  objects[1] = `<< /Type /Pages /Kids [${pageObjectNumbers
    .map((num) => `${num} 0 R`)
    .join(" ")}] /Count ${pages.length} >>`

  let pdf = "%PDF-1.4\n"
  const offsets: number[] = [0]

  objects.forEach((object, index) => {
    offsets.push(pdf.length)
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`
  })

  const xrefOffset = pdf.length

  pdf += `xref\n0 ${objects.length + 1}\n`
  pdf += "0000000000 65535 f \n"

  for (let i = 1; i <= objects.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`
  }

  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n`
  pdf += `startxref\n${xrefOffset}\n%%EOF`

  const bytes = new Uint8Array(pdf.length)

  for (let i = 0; i < pdf.length; i++) {
    bytes[i] = pdf.charCodeAt(i)
  }

  const blob = new Blob([bytes], { type: "application/pdf" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")

  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
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

  const [selectedLahanId, setSelectedLahanId] = useState("semua")
  const [tanggalMulai, setTanggalMulai] = useState("")
  const [tanggalAkhir, setTanggalAkhir] = useState("")
  const [searchKeyword, setSearchKeyword] = useState("")
  const [showFilterPanel, setShowFilterPanel] = useState(false)

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

  const filteredLaporan = useMemo(() => {
    return laporanList.filter((item) => {
      const matchLahan =
        selectedLahanId === "semua" ||
        item.panen.lahan_id === selectedLahanId

      const matchTanggalMulai =
        !tanggalMulai || item.panen.tanggal >= tanggalMulai

      const matchTanggalAkhir =
        !tanggalAkhir || item.panen.tanggal <= tanggalAkhir

      const keyword = searchKeyword.trim().toLowerCase()

      const matchKeyword =
        !keyword ||
        (item.panen.lahan?.lokasi || "").toLowerCase().includes(keyword) ||
        (item.panen.catatan || "").toLowerCase().includes(keyword) ||
        (item.jadwal?.varietas_padi || "").toLowerCase().includes(keyword)

      return matchLahan && matchTanggalMulai && matchTanggalAkhir && matchKeyword
    })
  }, [laporanList, selectedLahanId, tanggalMulai, tanggalAkhir, searchKeyword])

  const selectedLahanName = useMemo(() => {
    if (selectedLahanId === "semua") return ""

    return (
      laporanList.find((item) => item.panen.lahan_id === selectedLahanId)
        ?.panen.lahan?.lokasi || ""
    )
  }, [laporanList, selectedLahanId])

  const activeFilters = useMemo(() => {
    const filters: { key: string; label: string }[] = []

    if (searchKeyword.trim()) {
      filters.push({
        key: "search",
        label: `Cari: ${searchKeyword.trim()}`,
      })
    }

    if (selectedLahanId !== "semua") {
      filters.push({
        key: "lahan",
        label: `Lahan: ${selectedLahanName || "Dipilih"}`,
      })
    }

    if (tanggalMulai) {
      filters.push({
        key: "tanggalMulai",
        label: `Mulai: ${formatDateId(tanggalMulai)}`,
      })
    }

    if (tanggalAkhir) {
      filters.push({
        key: "tanggalAkhir",
        label: `Akhir: ${formatDateId(tanggalAkhir)}`,
      })
    }

    return filters
  }, [
    searchKeyword,
    selectedLahanId,
    selectedLahanName,
    tanggalMulai,
    tanggalAkhir,
  ])

  const removeFilter = (key: string) => {
    if (key === "search") {
      setSearchKeyword("")
      return
    }

    if (key === "lahan") {
      setSelectedLahanId("semua")
      return
    }

    if (key === "tanggalMulai") {
      setTanggalMulai("")
      return
    }

    if (key === "tanggalAkhir") {
      setTanggalAkhir("")
    }
  }

  const resetFilter = () => {
    setSelectedLahanId("semua")
    setTanggalMulai("")
    setTanggalAkhir("")
    setSearchKeyword("")
  }

  const summary = useMemo(() => {
    return filteredLaporan.reduce(
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
  }, [filteredLaporan])

  const handleDownloadPdf = async (item: LaporanItem) => {
    const bagiHasil = getBagiHasil(item)
    const lokasi = item.panen.lahan?.lokasi || "lahan"
    const fileName = `laporan-${sanitizeFileName(lokasi)}-${item.panen.tanggal}.pdf`

    setDownloadingId(item.panen.id)

    try {
      const lines = [
        `Lokasi Lahan: ${lokasi}`,
        `Luas Lahan: ${item.panen.lahan?.luas || "-"} m2`,
        `Periode: ${getPeriodeLaporan(item)}`,
        `Tanggal Panen: ${formatDateId(item.panen.tanggal)}`,
        `Varietas: ${item.jadwal?.varietas_padi || "-"}`,
        "",
        "Ringkasan Hasil",
        `Total Gabah / GKP: ${formatKg(item.panen.berat_gkp)} kg`,
        `Estimasi Beras: ${formatKg(bagiHasil?.total_beras || 0)} kg`,
        `Bagian Pemilik: ${formatKg(bagiHasil?.porsi_pemilik || 0)} kg`,
        `Bagian Pengelola: ${formatKg(bagiHasil?.porsi_pengelola || 0)} kg`,
        "",
        "Catatan Panen",
        item.panen.catatan || "-",
        "",
        "Aktivitas Tercatat",
        ...(item.aktivitas.length > 0
          ? item.aktivitas.map((aktivitas, index) => {
              return `${index + 1}. ${formatDateId(aktivitas.tanggal)} - ${aktivitas.jenis_aktivitas}${
                aktivitas.deskripsi ? ` - ${aktivitas.deskripsi}` : ""
              }`
            })
          : ["Tidak ada aktivitas tercatat."]),
      ]

      downloadSimplePdf(fileName, lines)
    } finally {
      setDownloadingId(null)
    }
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
    <main className="min-h-screen bg-[#f7faf5] text-gray-950">
      <RiceShareTopNav user={user} />
      <div className="pb-28 lg:pb-10">
      <div className="mx-auto w-full max-w-7xl px-4 py-5 md:px-6 md:py-7">

        <header className="mb-6 overflow-hidden rounded-[30px] border border-gray-100 bg-white p-5 shadow-[0_10px_35px_rgba(15,23,42,0.07)] md:flex md:items-center md:justify-between">
          
          

          <div className="flex w-full flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-medium text-green-700">RiceShare</p>

              <h1 className="text-2xl font-bold">
                Laporan Musim Tanam
              </h1>

              <p className="text-sm text-gray-500">
                Ringkasan aktivitas pertanian, hasil panen, dan pembagian hasil
                dalam tampilan modern.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              {user.role === "pengelola" && (
                <button
                  onClick={() => router.push("/panen")}
                  className="flex items-center justify-center gap-2 rounded-2xl border border-green-200 bg-white px-5 py-3 text-sm font-semibold text-black shadow-sm transition hover:bg-green-50"
                >
                  Input Panen
                </button>
              )}
            </div>
          </div>
        </header>

        <section className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="rounded-3xl border border-green-100 bg-white/80 p-5 shadow-lg">
            <p className="text-sm text-gray-500">Total Laporan</p>
            <h2 className="mt-2 text-2xl font-bold">
              {summary.totalLaporan}
            </h2>
          </div>

          <div className="rounded-3xl border border-green-100 bg-white/80 p-5 shadow-lg">
            <p className="text-sm text-gray-500">Total GKP</p>
            <h2 className="mt-2 text-2xl font-bold">
              {formatKg(summary.totalGkp)} kg
            </h2>
          </div>

          <div className="rounded-3xl border border-green-100 bg-white/80 p-5 shadow-lg">
            <p className="text-sm text-gray-500">Estimasi Beras</p>
            <h2 className="mt-2 text-2xl font-bold">
              {formatKg(summary.totalBeras)} kg
            </h2>
          </div>

          <div className="rounded-3xl border border-green-100 bg-white/80 p-5 shadow-lg">
            <p className="text-sm text-gray-500">Bagi Hasil</p>
            <h2 className="mt-2 text-2xl font-bold">
              {formatKg(summary.totalPemilik + summary.totalPengelola)} kg
            </h2>
          </div>
        </section>

        <section className="mb-6 rounded-[28px] border border-green-100 bg-white/80 p-5 shadow-xl">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={() => setShowFilterPanel((prev) => !prev)}
                className={`flex items-center justify-center gap-2 rounded-2xl border px-5 py-3 text-sm font-bold transition ${
                  showFilterPanel
                    ? "border-green-500 bg-green-600 text-white shadow-lg"
                    : "border-green-200 bg-white text-green-700 hover:bg-green-50"
                }`}
              >
                <Filter size={17} />
                Filter
                {activeFilters.length > 0 && (
                  <span className={`rounded-full px-2 py-0.5 text-xs ${
                    showFilterPanel
                      ? "bg-white text-green-700"
                      : "bg-green-100 text-green-700"
                  }`}>
                    {activeFilters.length}
                  </span>
                )}
              </button>

              {activeFilters.length === 0 ? (
                <p className="text-sm text-gray-500">
                  Belum ada filter aktif.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {activeFilters.map((filter) => (
                    <span
                      key={filter.key}
                      className="inline-flex items-center gap-2 rounded-2xl border border-green-200 bg-green-50 px-3 py-2 text-xs font-bold text-green-700"
                    >
                      {filter.label}
                      <button
                        type="button"
                        onClick={() => removeFilter(filter.key)}
                        className="rounded-full p-0.5 transition hover:bg-green-200"
                        aria-label={`Hapus filter ${filter.label}`}
                      >
                        <X size={14} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {activeFilters.length > 0 && (
              <button
                type="button"
                onClick={resetFilter}
                className="rounded-2xl border border-green-200 bg-white px-4 py-2 text-sm font-bold text-green-700 transition hover:bg-green-50"
              >
                Reset Semua
              </button>
            )}
          </div>

          {showFilterPanel && (
            <div className="mt-5 grid grid-cols-1 gap-4 rounded-[24px] border border-green-100 bg-green-50/40 p-4 md:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="mb-1 block text-sm font-medium">
                  Cari Laporan
                </label>

                <input
                  type="text"
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  placeholder="Cari lahan, varietas, catatan"
                  className="w-full rounded-2xl border border-green-200 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  Filter Lahan
                </label>

                <select
                  value={selectedLahanId}
                  onChange={(e) => setSelectedLahanId(e.target.value)}
                  className="w-full rounded-2xl border border-green-200 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="semua">Semua lahan</option>
                  {Array.from(
                    new Map(
                      laporanList
                        .map((item) => item.panen.lahan)
                        .filter(Boolean)
                        .map((lahan) => [lahan!.id, lahan!])
                    ).values()
                  ).map((lahan) => (
                    <option key={lahan.id} value={lahan.id}>
                      {lahan.lokasi} - {lahan.luas} m²
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  Tanggal Mulai
                </label>

                <input
                  type="date"
                  value={tanggalMulai}
                  onChange={(e) => setTanggalMulai(e.target.value)}
                  className="w-full rounded-2xl border border-green-200 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  Tanggal Akhir
                </label>

                <input
                  type="date"
                  value={tanggalAkhir}
                  onChange={(e) => setTanggalAkhir(e.target.value)}
                  className="w-full rounded-2xl border border-green-200 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
            </div>
          )}
        </section>

        {loadingData ? (
          <section className="mt-6 rounded-[30px] bg-white p-10 text-center shadow-lg">
            <p className="text-lg font-semibold text-gray-500">
              Memuat data laporan...
            </p>
          </section>
        ) : filteredLaporan.length === 0 ? (
          <section className="mt-6 rounded-[30px] bg-white p-10 text-center shadow-lg">
            <p className="text-lg font-semibold text-gray-500">
              Belum ada laporan panen tersedia.
            </p>
          </section>
        ) : (
          <section className="mt-6 space-y-4">

            {filteredLaporan.map((item) => {
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

                  <div className="mt-5 flex flex-col gap-2 sm:flex-row">

                    <button
                      onClick={() => setSelectedLaporan(item)}
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-green-200 bg-white px-4 text-sm font-bold text-green-700 transition hover:bg-green-50"
                    >
                      <Eye size={16} />
                      Detail
                    </button>

                    <button
                      onClick={() => handleDownloadPdf(item)}
                      disabled={downloadingId === item.panen.id}
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-green-600 to-emerald-500 px-4 text-sm font-bold text-white shadow-md shadow-green-100 transition hover:-translate-y-0.5 disabled:opacity-60"
                    >
                      <Download size={16} />
                      {downloadingId === item.panen.id
                        ? "Mengunduh..."
                        : "PDF"}
                    </button>

                  </div>

                </article>
              )
            })}

          </section>
        )}

      </div>
      </div>

      {/* MODAL OVERVIEW LAPORAN */}
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
                className="inline-flex h-10 items-center justify-center rounded-xl border border-gray-200 px-4 text-sm font-bold hover:bg-gray-50"
              >
                Tutup
              </button>
              <button
                onClick={() => handleDownloadPdf(selectedLaporan)}
                className="inline-flex h-10 items-center justify-center rounded-xl bg-gradient-to-r from-green-600 to-emerald-500 px-4 text-sm font-bold text-white shadow-md transition-all hover:-translate-y-0.5"
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