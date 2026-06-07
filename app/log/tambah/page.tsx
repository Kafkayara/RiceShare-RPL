"use client"

import { Suspense, useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
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

type TimelineOverrides = Record<string, string>

type JadwalTanam = {
  id: string
  lahan_id: string
  tanggal_mulai: string
  tanggal_selesai: string
  varietas_padi?: string | null
  jumlah_benih?: number | null
  catatan?: string | null
  timeline_overrides?: TimelineOverrides | null
}

type AktivitasLog = {
  id: string
  jenis_aktivitas: string
  tanggal?: string | null
}

type TimelineItem = {
  key: string
  label: string
  startDate: string
  endDate: string
  tanggalText: string
}

type TimelineTemplate = {
  key: string
  label: string
  startOffset: number
  endOffset: number
}

const timelineTemplates: TimelineTemplate[] = [
  { key: "mulai_tanam", label: "Mulai Tanam", startOffset: 0, endOffset: 0 },
  { key: "cek_adaptasi_bibit", label: "Cek Adaptasi Bibit", startOffset: 1, endOffset: 7 },
  { key: "pemupukan_1", label: "Pemupukan 1", startOffset: 7, endOffset: 14 },
  { key: "pantau_pertumbuhan_awal", label: "Pantau Pertumbuhan Awal", startOffset: 14, endOffset: 21 },
  { key: "persiapan_pengendalian_gulma", label: "Persiapan Pengendalian Gulma", startOffset: 21, endOffset: 30 },
  { key: "bersihkan_gulma", label: "Bersihkan Gulma", startOffset: 30, endOffset: 30 },
  { key: "pemupukan_2", label: "Pemupukan 2", startOffset: 35, endOffset: 40 },
  { key: "perawatan_lanjutan", label: "Perawatan Lanjutan", startOffset: 40, endOffset: 60 },
  { key: "cek_hama", label: "Cek Hama", startOffset: 60, endOffset: 69 },
  { key: "menjelang_panen", label: "Menjelang Panen", startOffset: 70, endOffset: 85 },
  { key: "panen_estimasi", label: "Panen Estimasi", startOffset: 80, endOffset: 105 },
  { key: "masa_istirahat", label: "Masa Istirahat", startOffset: 106, endOffset: 119 },
  { key: "siap_tanam_kembali", label: "Siap Tanam Kembali", startOffset: 120, endOffset: 120 },
]

function getTodayDateInputValue() {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, "0")
  const day = String(today.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function addDays(dateString: string, days: number) {
  const date = new Date(dateString)
  date.setDate(date.getDate() + days)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
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

function formatTimelineDate(startDate: string, endDate: string) {
  if (startDate === endDate) return formatDateId(endDate)
  return `${formatDateId(startDate)} - ${formatDateId(endDate)}`
}

function buildTimeline(
  tanggalMulai: string,
  overrides: TimelineOverrides = {}
): TimelineItem[] {
  const items: TimelineItem[] = []

  for (let index = 0; index < timelineTemplates.length; index++) {
    const template = timelineTemplates[index]
    const previousTemplate = timelineTemplates[index - 1]
    const previousItem = items[index - 1]

    let startDate = ""
    let endDate = ""

    if (index === 0) {
      startDate = tanggalMulai
      endDate = tanggalMulai
    } else {
      const previousEndOffset = previousTemplate?.endOffset || 0
      const gapFromPrevious = template.startOffset - previousEndOffset
      const duration = template.endOffset - template.startOffset
      startDate = addDays(previousItem.endDate, gapFromPrevious)
      endDate = addDays(startDate, duration)
    }

    if (overrides[template.key]) {
      endDate = overrides[template.key]
      if (template.startOffset === template.endOffset) {
        startDate = endDate
      }
    }

    items.push({
      key: template.key,
      label: template.label,
      startDate,
      endDate,
      tanggalText: formatTimelineDate(startDate, endDate),
    })
  }

  return items
}

function isDateInRange(date: string, startDate: string, endDate: string) {
  return date >= startDate && date <= endDate
}

// Alias fleksibel per template key — sama polanya dengan kalender
const AKTIVITAS_ALIASES: Record<string, string[]> = {
  mulai_tanam:                    ["mulai tanam", "tanam", "pindah tanam", "mulai"],
  cek_adaptasi_bibit:             ["cek adaptasi bibit", "adaptasi bibit", "cek bibit", "bibit"],
  pemupukan_1:                    ["pemupukan 1", "pemupukan", "pupuk", "pemupukan pertama"],
  pantau_pertumbuhan_awal:        ["pantau pertumbuhan awal", "pantau pertumbuhan", "pertumbuhan awal", "pantau"],
  persiapan_pengendalian_gulma:   ["persiapan pengendalian gulma", "pengendalian gulma", "gulma", "persiapan gulma"],
  bersihkan_gulma:                ["bersihkan gulma", "bersih gulma", "cabut gulma"],
  pemupukan_2:                    ["pemupukan 2", "pemupukan kedua", "pupuk 2"],
  perawatan_lanjutan:             ["perawatan lanjutan", "perawatan", "lanjutan", "pemeliharaan"],
  cek_hama:                       ["cek hama", "hama", "pengecekan hama", "semprot hama", "pestisida", "penanganan hama"],
  menjelang_panen:                ["menjelang panen", "persiapan panen", "pra panen"],
  panen_estimasi:                 ["panen estimasi", "panen", "panen raya", "panen selesai"],
  masa_istirahat:                 ["masa istirahat", "istirahat", "jeda", "pengolahan lahan"],
  siap_tanam_kembali:             ["siap tanam kembali", "siap tanam", "tanam kembali"],
}

function aktivitasSudahDicatat(
  jenisAktivitas: string,
  templateKey: string,
  templateLabel: string
): boolean {
  const j = jenisAktivitas.toLowerCase().trim()
  const aliases = AKTIVITAS_ALIASES[templateKey] || [templateLabel.toLowerCase()]
  return aliases.some((alias) => j.includes(alias) || alias.includes(j))
}

// ─── Komponen utama dipisah agar useSearchParams bisa dibungkus Suspense ───
function TambahLogAktivitasContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const lahanIdFromUrl = searchParams.get("lahan_id")
  const tanggalFromUrl = searchParams.get("tanggal")

  const [user, setUser] = useState<UserProfile | null>(null)
  const [checkingUser, setCheckingUser] = useState(true)

  const [lahanList, setLahanList] = useState<Lahan[]>([])
  const [lahanId, setLahanId] = useState("")

  const [jadwalTanam, setJadwalTanam] = useState<JadwalTanam | null>(null)
  const [aktivitasLogs, setAktivitasLogs] = useState<AktivitasLog[]>([])
  const [loadingLahanDetail, setLoadingLahanDetail] = useState(false)
  const [autoSelectedFromUrl, setAutoSelectedFromUrl] = useState(false)

  const [tanggal, setTanggal] = useState("")
  const [jenisAktivitas, setJenisAktivitas] = useState("")
  const [deskripsi, setDeskripsi] = useState("")
  const [buktiFile, setBuktiFile] = useState<File | null>(null)
  const [fileInputKey, setFileInputKey] = useState(0)

  const [loading, setLoading] = useState(false)
  const [showSuccessModal, setShowSuccessModal] = useState(false)

  const today = getTodayDateInputValue()

  const timeline = useMemo(() => {
    if (!jadwalTanam?.tanggal_mulai) return []
    return buildTimeline(
      jadwalTanam.tanggal_mulai,
      jadwalTanam.timeline_overrides || {}
    )
  }, [jadwalTanam])

  const availableActivities = useMemo(() => {
    if (!tanggal) return []

    // Kalau tidak ada jadwal tanam, izinkan input aktivitas bebas
    if (timeline.length === 0) {
      return [
        { key: "aktivitas_bebas", label: "Pemupukan", startDate: tanggal, endDate: tanggal, tanggalText: "" },
        { key: "aktivitas_bebas_2", label: "Pengairan", startDate: tanggal, endDate: tanggal, tanggalText: "" },
        { key: "aktivitas_bebas_3", label: "Cek Hama", startDate: tanggal, endDate: tanggal, tanggalText: "" },
        { key: "aktivitas_bebas_4", label: "Perawatan Lahan", startDate: tanggal, endDate: tanggal, tanggalText: "" },
        { key: "aktivitas_bebas_5", label: "Lainnya", startDate: tanggal, endDate: tanggal, tanggalText: "" },
      ]
    }

    return timeline.filter((item) => {
      const sedangBerjalan = isDateInRange(tanggal, item.startDate, item.endDate)

      // Cek apakah aktivitas ini sudah pernah dicatat pakai pencocokan fleksibel
      const sudahAdaLog = aktivitasLogs.some((log) => {
  return (
    aktivitasSudahDicatat(
      log.jenis_aktivitas,
      item.key,
      item.label
    ) &&
    log.tanggal === tanggal
  )
})

      return sedangBerjalan && !sudahAdaLog
    })
  }, [timeline, tanggal, aktivitasLogs])

  const selectedLahan = useMemo(() => {
    return lahanList.find((lahan) => lahan.id === lahanId) || null
  }, [lahanList, lahanId])

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
      const { data, error } = await supabase
        .from("lahan")
        .select("id, lokasi, luas, status")
        .order("lokasi", { ascending: true })
      if (error) {
        console.log("FETCH LAHAN ERROR:", error)
        return
      }
      setLahanList(data || [])
    }
    fetchLahan()
  }, [])

  useEffect(() => {
    if (availableActivities.length === 1) {
      setJenisAktivitas(availableActivities[0].label)
    } else {
      setJenisAktivitas("")
    }
  }, [availableActivities])

  const fetchSelectedLahanData = async (selectedLahanId: string) => {
    setLoadingLahanDetail(true)
    setJadwalTanam(null)
    setAktivitasLogs([])
    setJenisAktivitas("")

    const { data: jadwalData, error: jadwalError } = await supabase
      .from("jadwal_tanam")
      .select(`
        id,
        lahan_id,
        tanggal_mulai,
        tanggal_selesai,
        varietas_padi,
        jumlah_benih,
        catatan,
        timeline_overrides
      `)
      .eq("lahan_id", selectedLahanId)
      .order("created_at", { ascending: false })
      .limit(1)

    if (jadwalError) {
      console.log("FETCH JADWAL ERROR:", jadwalError)
      setLoadingLahanDetail(false)
      return
    }

    const latestJadwal = jadwalData?.[0] || null
    setJadwalTanam(latestJadwal)

    const { data: logData, error: logError } = await supabase
      .from("aktivitas_log")
      .select("id, jenis_aktivitas, tanggal")
      .eq("lahan_id", selectedLahanId)

    if (logError) {
      console.log("FETCH AKTIVITAS LOG ERROR:", logError)
      setLoadingLahanDetail(false)
      return
    }

    setAktivitasLogs(logData || [])
    setLoadingLahanDetail(false)
  }

  useEffect(() => {
    const applyFromUrl = async () => {
      if (!lahanIdFromUrl) return
      if (autoSelectedFromUrl) return
      if (lahanList.length === 0) return

      const isValidLahan = lahanList.some((lahan) => lahan.id === lahanIdFromUrl)
      if (!isValidLahan) {
        setAutoSelectedFromUrl(true)
        return
      }

      setLahanId(lahanIdFromUrl)

      if (tanggalFromUrl && tanggalFromUrl <= today) {
        setTanggal(tanggalFromUrl)
      } else {
        setTanggal("")
      }

      setJenisAktivitas("")
      setAutoSelectedFromUrl(true)
      await fetchSelectedLahanData(lahanIdFromUrl)
    }

    applyFromUrl()
  }, [lahanIdFromUrl, tanggalFromUrl, lahanList, autoSelectedFromUrl, today])

  const handleLahanChange = async (value: string) => {
    setLahanId(value)
    setTanggal("")
    setJenisAktivitas("")
    if (!value) {
      setJadwalTanam(null)
      setAktivitasLogs([])
      return
    }
    await fetchSelectedLahanData(value)
  }

  const handleTanggalChange = (value: string) => {
    setTanggal(value)
    setJenisAktivitas("")
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) {
      setBuktiFile(null)
      return
    }
    const allowedTypes = ["image/png", "image/jpeg", "image/jpg"]
    if (!allowedTypes.includes(file.type)) {
      alert("File bukti harus berupa PNG atau JPG.")
      e.target.value = ""
      setBuktiFile(null)
      return
    }
    const maxSize = 5 * 1024 * 1024
    if (file.size > maxSize) {
      alert("Ukuran file maksimal 5MB.")
      e.target.value = ""
      setBuktiFile(null)
      return
    }
    setBuktiFile(file)
  }

  const resetForm = () => {
    setLahanId("")
    setJadwalTanam(null)
    setAktivitasLogs([])
    setTanggal("")
    setJenisAktivitas("")
    setDeskripsi("")
    setBuktiFile(null)
    setFileInputKey((prev) => prev + 1)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!user || user.role !== "pengelola") {
      alert("Hanya pengelola yang boleh input log aktivitas.")
      return
    }
    if (!lahanId) {
      alert("Lahan wajib dipilih.")
      return
    }
    if (!tanggal) {
      alert("Tanggal aktivitas wajib diisi.")
      return
    }
    if (tanggal > today) {
      alert("Tanggal aktivitas tidak boleh lebih dari hari ini.")
      return
    }
    if (availableActivities.length === 0) {
      alert("Tidak ada aktivitas yang bisa dicatat pada tanggal ini.")
      return
    }
    if (!jenisAktivitas) {
      alert("Jenis aktivitas wajib dipilih.")
      return
    }
    if (!deskripsi.trim()) {
      alert("Deskripsi aktivitas wajib diisi.")
      return
    }

    setLoading(true)

    let buktiUrl: string | null = null

    if (buktiFile) {
      const fileExt = buktiFile.name.split(".").pop()
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`
      const filePath = `aktivitas/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from("bukti-aktivitas")
        .upload(filePath, buktiFile)

      if (uploadError) {
        console.log("UPLOAD BUKTI ERROR:", uploadError)
        alert("Gagal upload bukti aktivitas.")
        setLoading(false)
        return
      }

      const { data: publicUrlData } = supabase.storage
        .from("bukti-aktivitas")
        .getPublicUrl(filePath)

      buktiUrl = publicUrlData.publicUrl
    }

    const { error: insertError } = await supabase.from("aktivitas_log").insert([
      {
        lahan_id: lahanId,
        pengelola_id: user.id,
        tanggal,
        jenis_aktivitas: jenisAktivitas,
        deskripsi: deskripsi.trim(),
        bukti: buktiUrl,
      },
    ])

    if (insertError) {
      console.log("INSERT LOG ERROR:", insertError)
      alert("Gagal menyimpan log aktivitas.")
      setLoading(false)
      return
    }

    setLoading(false)
    setShowSuccessModal(true)
  }

  const handleInputAgain = async () => {
    const lastLahanId = lahanId
    setTanggal("")
    setJenisAktivitas("")
    setDeskripsi("")
    setBuktiFile(null)
    setFileInputKey((prev) => prev + 1)
    setShowSuccessModal(false)
    if (lastLahanId) {
      await fetchSelectedLahanData(lastLahanId)
    }
  }

  const handleExit = () => {
    resetForm()
    setShowSuccessModal(false)
    router.push("/log")
  }

  if (checkingUser) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-green-50 via-lime-50 to-emerald-100 p-6 text-gray-900">
        Loading...
      </main>
    )
  }

  if (!user) return null

  const isPengelola = user.role === "pengelola"

  return (
    <main className="min-h-screen bg-gradient-to-br from-green-50 via-lime-50 to-emerald-100 text-gray-900">
      <div className="mx-auto w-full max-w-4xl px-4 py-4 md:px-6 md:py-6">
        <header className="mb-6 overflow-hidden rounded-[30px] border border-green-100 bg-white/80 p-5 shadow-2xl backdrop-blur-xl sm:flex sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold tracking-wide text-green-700">RiceShare</p>
            <h1 className="text-2xl font-bold">Tambah Log Aktivitas</h1>
            <p className="text-sm text-gray-500">
             Catat aktivitas pengelolaan lahan sesuai jadwal tanam.
            </p>
          </div>
          <button
            onClick={() => router.push("/log")}
            className="rounded-2xl border border-green-100 bg-white px-5 py-3 text-sm font-semibold text-gray-700 transition-all hover:bg-green-50"
          >
            Riwayat Log
          </button>
        </header>

        {!isPengelola ? (
          <section className="rounded-2xl border border-yellow-200 bg-yellow-50 p-4">
            <h2 className="font-semibold text-yellow-900">Mode Pemilik</h2>
            <p className="text-sm text-yellow-800">
              Pemilik hanya dapat melihat log aktivitas. Input log hanya tersedia untuk pengelola.
            </p>
            <button
              onClick={() => router.push("/log")}
              className="mt-4 rounded-xl border border-yellow-300 px-4 py-2 text-sm font-medium hover:bg-yellow-100"
            >
              Kembali ke Riwayat Aktivitas
            </button>
          </section>
        ) : (
          <section className="rounded-[28px] border border-green-100 bg-white/90 p-6 shadow-xl backdrop-blur-sm">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium">
                  Pilih Lahan <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <select
                    className="w-full appearance-none rounded-xl border bg-white px-3 py-2 pr-10 outline-none focus:ring-2 border-gray-200 focus:border-green-400 focus:ring-4 focus:ring-green-100"
                    value={lahanId}
                    onChange={(e) => handleLahanChange(e.target.value)}
                  >
                    <option value="">Pilih lahan</option>
                    {lahanList.map((lahan) => (
                      <option key={lahan.id} value={lahan.id}>
                        {lahan.lokasi} - {lahan.luas} m²
                      </option>
                    ))}
                  </select>
                  <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-gray-500">
                    ▾
                  </span>
                </div>
                {selectedLahan && lahanIdFromUrl && (
                  <p className="mt-2 text-xs text-green-700">
                    Lahan otomatis dipilih dari halaman sebelumnya.
                  </p>
                )}
                {tanggalFromUrl && tanggal && (
                  <p className="mt-1 text-xs text-green-700">
                    Tanggal otomatis dipilih dari kalender.
                  </p>
                )}
              </div>

              {loadingLahanDetail && (
                <div className="rounded-2xl border border-green-100 bg-green-50 p-4 text-sm text-green-700">
                  Memuat jadwal aktivitas lahan...
                </div>
              )}

              {lahanId && !loadingLahanDetail && !jadwalTanam && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                  ⚠️ Lahan ini belum memiliki jadwal tanam aktif. Kamu tetap bisa mencatat aktivitas bebas.
                </div>
              )}

              {lahanId && !loadingLahanDetail && (
                <>
                  <div>
                    <label className="mb-1 block text-sm font-medium">
                      Tanggal Aktivitas <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      max={today}
                      value={tanggal}
                      onChange={(e) => handleTanggalChange(e.target.value)}
                      className="w-full rounded-xl border px-3 py-2 outline-none focus:ring-2 border-gray-200 focus:border-green-400 focus:ring-4 focus:ring-green-100"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium">
                      Jenis Aktivitas <span className="text-red-500">*</span>
                    </label>
                    {!tanggal ? (
                      <div className="rounded-2xl border border-green-100 bg-green-50 p-4 text-sm text-green-700">
                        Pilih tanggal aktivitas terlebih dahulu.
                      </div>
                    ) : availableActivities.length === 0 ? (
                      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                        Tidak ada aktivitas terjadwal yang bisa dicatat pada tanggal ini, atau aktivitas pada tanggal ini sudah dicatat.
                      </div>
                    ) : availableActivities.length === 1 ? (
                      <div className="rounded-2xl border border-green-100 bg-green-50/60 p-4">
                        <p className="text-sm text-gray-500">Aktivitas saat ini</p>
                        <p className="font-semibold">{availableActivities[0].label}</p>
                        <p className="text-sm text-gray-500">
                          {availableActivities[0].tanggalText}
                        </p>
                      </div>
                    ) : (
                      <div className="relative">
                        <select
                          className="w-full appearance-none rounded-xl border bg-white px-3 py-2 pr-10 outline-none focus:ring-2 border-gray-200 focus:border-green-400 focus:ring-4 focus:ring-green-100"
                          value={jenisAktivitas}
                          onChange={(e) => setJenisAktivitas(e.target.value)}
                        >
                          <option value="">Pilih aktivitas</option>
                          {availableActivities.map((item) => (
                            <option key={item.key} value={item.label}>
                              {item.label}
                            </option>
                          ))}
                        </select>
                        <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-gray-500">
                          ▾
                        </span>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium">
                      Deskripsi <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      placeholder="Masukkan catatan aktivitas"
                      className="min-h-24 w-full rounded-xl border px-3 py-2 outline-none focus:ring-2 border-gray-200 focus:border-green-400 focus:ring-4 focus:ring-green-100"
                      value={deskripsi}
                      onChange={(e) => setDeskripsi(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium">
                      Upload Bukti
                    </label>
                    <input
                      key={fileInputKey}
                      type="file"
                      accept="image/png,image/jpeg,image/jpg"
                      className="w-full rounded-2xl border border-dashed border-green-200 bg-green-50/50 px-4 py-3 text-sm"
                      onChange={handleFileChange}
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Format: JPG atau PNG. Maksimal 5MB.
                    </p>
                    {buktiFile && (
                      <p className="mt-2 text-xs text-green-700">
                        File dipilih: {buktiFile.name}
                      </p>
                    )}
                  </div>
                </>
              )}

              <div className="flex flex-col gap-2 pt-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => router.back()}
                  className="w-full rounded-2xl border border-gray-200 bg-white px-5 py-3 font-medium transition-all hover:bg-gray-50 sm:w-1/2"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={
                    loading ||
                    !tanggal ||
                    availableActivities.length === 0
                  }
                  className="w-full rounded-2xl bg-gradient-to-r from-green-500 to-emerald-600 px-5 py-3 font-semibold text-white shadow-lg transition-all hover:scale-[1.02] disabled:opacity-60 sm:w-1/2"
                >
                  {loading ? "Menyimpan..." : "Simpan"}
                </button>
              </div>
            </form>
          </section>
        )}
      </div>

      {showSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-md rounded-[30px] border border-green-100 bg-white p-6 shadow-2xl">
            <p className="text-sm font-medium text-green-700">
              Data berhasil disimpan
            </p>
            <h2 className="text-xl font-bold">Log Aktivitas Tercatat</h2>
            <p className="mt-4 rounded-2xl bg-green-50 p-4 text-sm text-gray-700">
              Aktivitas berhasil dicatat dan dapat dilihat pada halaman riwayat aktivitas.
            </p>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <button
                onClick={handleExit}
                className="w-full rounded-2xl border border-gray-200 bg-white px-5 py-3 font-medium transition-all hover:bg-gray-50 sm:w-1/2"
              >
                Lihat Riwayat
              </button>
              <button
                onClick={handleInputAgain}
                className="w-full rounded-2xl bg-gradient-to-r from-green-500 to-emerald-600 px-5 py-3 font-semibold text-white shadow-lg transition-all hover:scale-[1.02] disabled:opacity-60 sm:w-1/2"
              >
                Input Lagi
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

// ─── Wrapper dengan Suspense — INI yang di-export sebagai page ───
export default function TambahLogAktivitasPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-gray-50 p-6 text-gray-900">
          Loading...
        </main>
      }
    >
      <TambahLogAktivitasContent />
    </Suspense>
  )
}