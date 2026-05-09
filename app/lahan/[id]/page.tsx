"use client"

import { useEffect, useMemo, useState } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { syncLahanStatus } from "@/lib/syncLahanStatus"

type UserProfile = {
  id: string
  nama: string
  email: string
  role: "pemilik" | "pengelola"
}

type TimelineOverrides = Record<string, string>

type JadwalTanam = {
  id: string
  tanggal_mulai: string
  tanggal_selesai: string
  status: string
  varietas_padi?: string | null
  jumlah_benih?: number | null
  catatan?: string | null
  created_at?: string | null
  timeline_overrides?: TimelineOverrides | null
}

type AktivitasLog = {
  id: string
  jenis_aktivitas: string
  tanggal?: string | null
  deskripsi?: string | null
  bukti?: string | null
  created_at?: string | null
}

type LahanDetail = {
  id: string
  lokasi: string
  luas: number
  status: string
  jadwal_tanam?: JadwalTanam[]
  aktivitas_log?: AktivitasLog[]
}

type TimelineItem = {
  key: string
  label: string
  startDate: string
  endDate: string
  tanggalText: string
  status: "selesai" | "berjalan" | "belum"
}

type TimelineTemplate = {
  key: string
  label: string
  startOffset: number
  endOffset: number
}

type ActiveTab = "timeline" | "detail"

const timelineTemplates: TimelineTemplate[] = [
  {
    key: "mulai_tanam",
    label: "Mulai Tanam",
    startOffset: 0,
    endOffset: 0,
  },
  {
    key: "cek_adaptasi_bibit",
    label: "Cek Adaptasi Bibit",
    startOffset: 1,
    endOffset: 7,
  },
  {
    key: "pemupukan_1",
    label: "Pemupukan 1",
    startOffset: 7,
    endOffset: 14,
  },
  {
    key: "pantau_pertumbuhan_awal",
    label: "Pantau Pertumbuhan Awal",
    startOffset: 14,
    endOffset: 21,
  },
  {
    key: "persiapan_pengendalian_gulma",
    label: "Persiapan Pengendalian Gulma",
    startOffset: 21,
    endOffset: 30,
  },
  {
    key: "bersihkan_gulma",
    label: "Bersihkan Gulma",
    startOffset: 30,
    endOffset: 30,
  },
  {
    key: "pemupukan_2",
    label: "Pemupukan 2",
    startOffset: 35,
    endOffset: 40,
  },
  {
    key: "perawatan_lanjutan",
    label: "Perawatan Lanjutan",
    startOffset: 40,
    endOffset: 60,
  },
  {
    key: "cek_hama",
    label: "Cek Hama",
    startOffset: 60,
    endOffset: 69,
  },
  {
    key: "menjelang_panen",
    label: "Menjelang Panen",
    startOffset: 70,
    endOffset: 85,
  },
  {
    key: "panen_estimasi",
    label: "Panen Estimasi",
    startOffset: 80,
    endOffset: 105,
  },
  {
    key: "masa_istirahat",
    label: "Masa Istirahat",
    startOffset: 106,
    endOffset: 119,
  },
  {
    key: "siap_tanam_kembali",
    label: "Siap Tanam Kembali",
    startOffset: 120,
    endOffset: 120,
  },
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

function differenceInDays(startDate: string, endDate: string) {
  const start = new Date(startDate)
  const end = new Date(endDate)

  start.setHours(0, 0, 0, 0)
  end.setHours(0, 0, 0, 0)

  const diff = end.getTime() - start.getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}

function formatDateId(dateString?: string | null) {
  if (!dateString) return "-"

  return new Date(dateString).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

function formatDateTimeId(dateString?: string | null) {
  if (!dateString) return "-"

  return new Date(dateString).toLocaleString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
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
      return "bg-purple-100 text-purple-700 border-purple-200"
    case "belum_digunakan":
      return "bg-slate-100 text-slate-700 border-slate-200"
    default:
      return "bg-gray-100 text-gray-700 border-gray-200"
  }
}

function formatTimelineDate(startDate: string, endDate: string) {
  if (startDate === endDate) return formatDateId(endDate)
  return `${formatDateId(startDate)} - ${formatDateId(endDate)}`
}

function getTimelineStatus(
  today: string,
  startDate: string,
  endDate: string,
  label: string,
  aktivitasLogs: AktivitasLog[]
): "selesai" | "berjalan" | "belum" {
  const sudahAdaLog = aktivitasLogs.some((log) => {
    return (
      log.jenis_aktivitas === label &&
      !!log.tanggal &&
      log.tanggal >= startDate &&
      log.tanggal <= endDate
    )
  })

  if (sudahAdaLog) return "selesai"
  if (today >= startDate && today <= endDate) return "berjalan"

  return "belum"
}

function buildTimeline(
  tanggalMulai: string,
  today: string,
  overrides: TimelineOverrides = {},
  aktivitasLogs: AktivitasLog[]
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
      status: getTimelineStatus(today, startDate, endDate, template.label, aktivitasLogs),
    })
  }

  return items
}

function getCurrentTimelineIndex(timeline: TimelineItem[]) {
  const runningIndex = timeline.findIndex((item) => item.status === "berjalan")

  if (runningIndex !== -1) return runningIndex

  const firstUpcomingIndex = timeline.findIndex((item) => item.status === "belum")

  if (firstUpcomingIndex !== -1) {
    return Math.max(firstUpcomingIndex - 1, 0)
  }

  return timeline.length - 1
}

function getCurrentStage(timeline: TimelineItem[]) {
  if (timeline.length === 0) return "Belum ada siklus tanam"

  const current = timeline.find((item) => item.status === "berjalan")
  if (current) return current.label

  const firstUpcoming = timeline.find((item) => item.status === "belum")
  if (firstUpcoming) return "Menunggu tahap berikutnya"

  return "Siklus selesai"
}

function getTimelineDotStyle(status: TimelineItem["status"]) {
  switch (status) {
    case "selesai":
      return "border-green-600 bg-green-600 text-white"
    case "berjalan":
      return "border-green-600 bg-green-100 text-green-700"
    case "belum":
      return "border-gray-300 bg-white text-gray-400"
    default:
      return "border-gray-300 bg-white text-gray-400"
  }
}

function getTimelineTextStyle(status: TimelineItem["status"]) {
  switch (status) {
    case "selesai":
    case "berjalan":
      return "text-gray-900"
    case "belum":
      return "text-gray-500"
    default:
      return "text-gray-500"
  }
}

export default function DetailLahanPage() {
  const router = useRouter()
  const params = useParams()
  const searchParams = useSearchParams()

  const lahanId = params.id as string
  const shouldOpenEditJadwal = searchParams.get("open_edit_jadwal") === "1"

  const [user, setUser] = useState<UserProfile | null>(null)
  const [checkingUser, setCheckingUser] = useState(true)
  const [loadingData, setLoadingData] = useState(true)

  const [lahan, setLahan] = useState<LahanDetail | null>(null)
  const [activeTab, setActiveTab] = useState<ActiveTab>("timeline")

  const [showEditModal, setShowEditModal] = useState(false)
  const [savingEdit, setSavingEdit] = useState(false)
  const [autoOpenedEditFromUrl, setAutoOpenedEditFromUrl] = useState(false)

  const [editTanggalMulai, setEditTanggalMulai] = useState("")
  const [editTimelineDates, setEditTimelineDates] = useState<Record<string, string>>({})
  const [editVarietasPadi, setEditVarietasPadi] = useState("")
  const [editJumlahBenih, setEditJumlahBenih] = useState("")
  const [editCatatan, setEditCatatan] = useState("")

  const today = getTodayDateInputValue()

  const fetchLahanDetail = async () => {
    setLoadingData(true)

    await syncLahanStatus()

    const { data: lahanData, error: lahanError } = await supabase
      .from("lahan")
      .select("id, lokasi, luas, status")
      .eq("id", lahanId)
      .single()

    if (lahanError || !lahanData) {
      console.log("FETCH LAHAN ERROR:", lahanError)
      setLahan(null)
      setLoadingData(false)
      return
    }

    const { data: jadwalData, error: jadwalError } = await supabase
      .from("jadwal_tanam")
      .select(`
        id,
        tanggal_mulai,
        tanggal_selesai,
        status,
        varietas_padi,
        jumlah_benih,
        catatan,
        created_at,
        timeline_overrides
      `)
      .eq("lahan_id", lahanId)
      .order("created_at", { ascending: false })
      .limit(1)

    if (jadwalError) {
      console.log("FETCH JADWAL ERROR:", jadwalError)
    }

    const { data: logData, error: logError } = await supabase
      .from("aktivitas_log")
      .select("id, jenis_aktivitas, tanggal, deskripsi, bukti, created_at")
      .eq("lahan_id", lahanId)
      .order("tanggal", { ascending: false })
      .order("created_at", { ascending: false })

    if (logError) {
      console.log("FETCH AKTIVITAS LOG ERROR:", logError)
    }

    setLahan({
      ...lahanData,
      jadwal_tanam: jadwalData || [],
      aktivitas_log: logData || [],
    })

    setLoadingData(false)
  }

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
    if (lahanId) {
      fetchLahanDetail()
    }
  }, [lahanId])

  const jadwalTerbaru = lahan?.jadwal_tanam?.[0]
  const aktivitasLogs = useMemo(() => lahan?.aktivitas_log || [], [lahan?.aktivitas_log])
  const overrides = jadwalTerbaru?.timeline_overrides || {}

  const timeline = useMemo(() => {
    if (!jadwalTerbaru?.tanggal_mulai) return []

    return buildTimeline(
      jadwalTerbaru.tanggal_mulai,
      today,
      overrides,
      aktivitasLogs
    )
  }, [
    jadwalTerbaru?.tanggal_mulai,
    today,
    JSON.stringify(overrides),
    aktivitasLogs,
  ])

  const aktivitasTerbaru = useMemo(() => {
    return aktivitasLogs.slice(0, 5)
  }, [aktivitasLogs])

  const currentTimelineIndex =
    timeline.length > 0 ? getCurrentTimelineIndex(timeline) : -1

  const currentTimeline = timeline[currentTimelineIndex]

  const editableTimelineItems =
    currentTimelineIndex <= 0
      ? timeline.slice(0, 1)
      : timeline.slice(currentTimelineIndex - 1, currentTimelineIndex + 1)

  const editMaxDate = currentTimeline?.endDate || today

  const hariKe =
    jadwalTerbaru?.tanggal_mulai &&
    [
      "masa_tanam_aktif",
      "menjelang_panen",
      "panen_selesai",
      "istirahat",
      "siap_tanam_kembali",
      "tanam",
    ].includes(lahan?.status || "")
      ? differenceInDays(jadwalTerbaru.tanggal_mulai, today)
      : null

  const panenEstimasi = timeline.find((item) => item.key === "panen_estimasi")
  const siapTanamKembali = timeline.find(
    (item) => item.key === "siap_tanam_kembali"
  )

  const estimasiGabahMin = jadwalTerbaru?.jumlah_benih
    ? jadwalTerbaru.jumlah_benih * 150
    : null

  const estimasiGabahMax = jadwalTerbaru?.jumlah_benih
    ? jadwalTerbaru.jumlah_benih * 250
    : null

  const openEditModal = () => {
    if (!jadwalTerbaru) {
      alert("Belum ada jadwal tanam yang bisa diedit.")
      return
    }

    const initialEditDates: Record<string, string> = {}

    editableTimelineItems.forEach((item) => {
      initialEditDates[item.key] = item.endDate
    })

    setEditTanggalMulai(jadwalTerbaru.tanggal_mulai || "")
    setEditTimelineDates(initialEditDates)
    setEditVarietasPadi(jadwalTerbaru.varietas_padi || "")
    setEditJumlahBenih(
      jadwalTerbaru.jumlah_benih !== null &&
        jadwalTerbaru.jumlah_benih !== undefined
        ? String(jadwalTerbaru.jumlah_benih)
        : ""
    )
    setEditCatatan(jadwalTerbaru.catatan || "")
    setShowEditModal(true)
  }

  useEffect(() => {
    if (!shouldOpenEditJadwal) return
    if (autoOpenedEditFromUrl) return
    if (loadingData) return
    if (!jadwalTerbaru) return
    if (user?.role !== "pengelola") return

    setAutoOpenedEditFromUrl(true)
    openEditModal()
  }, [
    shouldOpenEditJadwal,
    autoOpenedEditFromUrl,
    loadingData,
    jadwalTerbaru,
    user,
  ])

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!jadwalTerbaru) return

    if (!editVarietasPadi.trim()) {
      alert("Varietas padi wajib diisi.")
      return
    }

    const jumlahBenihNumber = parseFloat(editJumlahBenih.replace(",", "."))

    if (!editJumlahBenih || isNaN(jumlahBenihNumber) || jumlahBenihNumber <= 0) {
      alert("Jumlah benih harus berupa angka lebih dari 0.")
      return
    }

    setSavingEdit(true)

    if (currentTimelineIndex <= 0) {
      if (!editTanggalMulai) {
        alert("Tanggal mulai tanam wajib diisi.")
        setSavingEdit(false)
        return
      }

      if (editTanggalMulai > editMaxDate) {
        alert(`Tanggal mulai tanam tidak boleh lebih dari ${formatDateId(editMaxDate)}.`)
        setSavingEdit(false)
        return
      }

      const newTimeline = buildTimeline(editTanggalMulai, today, {}, aktivitasLogs)
      const newPanenEstimasi = newTimeline.find(
        (item) => item.key === "panen_estimasi"
      )

      const { error } = await supabase
        .from("jadwal_tanam")
        .update({
          tanggal_mulai: editTanggalMulai,
          tanggal_selesai:
            newPanenEstimasi?.endDate || addDays(editTanggalMulai, 105),
          varietas_padi: editVarietasPadi.trim(),
          jumlah_benih: jumlahBenihNumber,
          catatan: editCatatan.trim() || null,
          timeline_overrides: {},
        })
        .eq("id", jadwalTerbaru.id)

      if (error) {
        console.log("UPDATE JADWAL ERROR:", error)
        alert("Gagal mengubah jadwal tanam. Cek console browser.")
        setSavingEdit(false)
        return
      }

      setSavingEdit(false)
      setShowEditModal(false)
      await fetchLahanDetail()
      return
    }

    const updatedOverrides: TimelineOverrides = {
      ...(jadwalTerbaru.timeline_overrides || {}),
    }

    for (const item of editableTimelineItems) {
      const editedDate = editTimelineDates[item.key]

      if (!editedDate) {
        alert(`Tanggal ${item.label} wajib diisi.`)
        setSavingEdit(false)
        return
      }

      if (editedDate > editMaxDate) {
        alert(`Tanggal ${item.label} tidak boleh lebih dari ${formatDateId(editMaxDate)}.`)
        setSavingEdit(false)
        return
      }

      updatedOverrides[item.key] = editedDate
    }

    const newTimeline = buildTimeline(
      jadwalTerbaru.tanggal_mulai,
      today,
      updatedOverrides,
      aktivitasLogs
    )

    const newPanenEstimasi = newTimeline.find(
      (item) => item.key === "panen_estimasi"
    )

    const { error } = await supabase
      .from("jadwal_tanam")
      .update({
        tanggal_selesai:
          newPanenEstimasi?.endDate || jadwalTerbaru.tanggal_selesai,
        varietas_padi: editVarietasPadi.trim(),
        jumlah_benih: jumlahBenihNumber,
        catatan: editCatatan.trim() || null,
        timeline_overrides: updatedOverrides,
      })
      .eq("id", jadwalTerbaru.id)

    if (error) {
      console.log("UPDATE JADWAL ERROR:", error)
      alert("Gagal mengubah jadwal tanam. Cek console browser.")
      setSavingEdit(false)
      return
    }

    setSavingEdit(false)
    setShowEditModal(false)
    await fetchLahanDetail()
  }

  if (checkingUser) {
    return (
      <main className="min-h-screen bg-gray-50 p-6 text-gray-900">
        Loading...
      </main>
    )
  }

  if (!user) return null

  const isPengelola = user.role === "pengelola"

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900">
      <div className="mx-auto w-full max-w-6xl px-4 py-4 md:px-6 md:py-6">
        <header className="mb-6 rounded-2xl border bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <button
              onClick={() => router.push("/lahan")}
              className="rounded-xl border px-3 py-2 text-sm font-medium hover:bg-gray-50"
            >
              ← Kembali
            </button>

            <button
              onClick={() => router.push("/dashboard")}
              className="rounded-xl border px-3 py-2 text-sm font-medium hover:bg-gray-50"
            >
              Dashboard
            </button>
          </div>

          <p className="text-sm font-medium text-green-700">RiceShare</p>
          <h1 className="text-2xl font-bold">
            {lahan ? `Lahan ${lahan.lokasi}` : "Detail Lahan"}
          </h1>
        </header>

        {loadingData ? (
          <section className="rounded-2xl border bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">Memuat detail lahan...</p>
          </section>
        ) : !lahan ? (
          <section className="rounded-2xl border bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">Data lahan tidak ditemukan.</p>
          </section>
        ) : (
          <>
            <section className="mb-6 rounded-2xl border bg-white p-4 shadow-sm">
              <div className="flex border-b text-sm font-medium">
                <button
                  onClick={() => setActiveTab("timeline")}
                  className={`flex-1 px-4 py-3 text-center ${
                    activeTab === "timeline"
                      ? "border-b-2 border-blue-600 text-blue-600"
                      : "text-gray-500 hover:text-gray-900"
                  }`}
                >
                  Timeline
                </button>

                <button
                  onClick={() => setActiveTab("detail")}
                  className={`flex-1 px-4 py-3 text-center ${
                    activeTab === "detail"
                      ? "border-b-2 border-blue-600 text-blue-600"
                      : "text-gray-500 hover:text-gray-900"
                  }`}
                >
                  Detail
                </button>
              </div>

              {activeTab === "timeline" && (
                <div className="grid grid-cols-1 gap-6 pt-5 lg:grid-cols-3">
                  <div className="lg:col-span-2">
                    <h2 className="mb-4 font-bold">Progress Musim Tanam</h2>

                    {timeline.length === 0 ? (
                      <p className="rounded-xl bg-gray-50 p-4 text-sm text-gray-500">
                        Timeline belum tersedia karena lahan belum memiliki data mulai tanam.
                      </p>
                    ) : (
                      <div className="relative pl-6">
                        <div className="absolute left-[11px] top-2 h-[calc(100%-20px)] w-px bg-gray-300" />

                        <div className="space-y-5">
                          {timeline.map((item) => (
                            <div key={item.key} className="relative">
                              <div
                                className={`absolute -left-6 top-1 flex h-6 w-6 items-center justify-center rounded-full border text-xs font-bold ${getTimelineDotStyle(
                                  item.status
                                )}`}
                              >
                                {item.status === "selesai" ? "✓" : ""}
                              </div>

                              <div className="pl-2">
                                <p
                                  className={`font-semibold ${getTimelineTextStyle(
                                    item.status
                                  )}`}
                                >
                                  {item.label}
                                </p>
                                <p className="text-sm text-gray-500">
                                  {item.tanggalText}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <aside className="rounded-2xl border bg-white p-4 shadow-sm">
                    <h2 className="mb-4 font-bold">Informasi Lahan</h2>

                    <div className="space-y-3 text-sm">
                      <div className="rounded-xl bg-gray-50 p-3">
                        <p className="text-gray-500">Status</p>
                        <span
                          className={`mt-1 inline-block rounded-full border px-3 py-1 text-xs font-medium ${getStatusStyle(
                            lahan.status
                          )}`}
                        >
                          {formatStatus(lahan.status)}
                        </span>
                      </div>

                      <div className="rounded-xl bg-gray-50 p-3">
                        <p className="text-gray-500">Hari Saat Ini</p>
                        <p className="font-semibold">
                          {hariKe !== null ? `Hari ke-${hariKe}` : "-"}
                        </p>
                      </div>

                      <div className="rounded-xl bg-gray-50 p-3">
                        <p className="text-gray-500">Tahap Saat Ini</p>
                        <p className="font-semibold">
                          {getCurrentStage(timeline)}
                        </p>
                      </div>

                      <div className="rounded-xl bg-gray-50 p-3">
                        <p className="text-gray-500">Estimasi Panen</p>
                        <p className="font-semibold">
                          {panenEstimasi ? panenEstimasi.tanggalText : "-"}
                        </p>
                      </div>

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
                            ? `${formatNumber(jadwalTerbaru.jumlah_benih)} kg`
                            : "-"}
                        </p>
                      </div>

                      <div className="rounded-xl bg-gray-50 p-3">
                        <p className="text-gray-500">Luas Lahan</p>
                        <p className="font-semibold">{lahan.luas} m²</p>
                      </div>
                    </div>
                  </aside>
                </div>
              )}

              {activeTab === "detail" && (
                <div className="grid grid-cols-1 gap-4 pt-5 md:grid-cols-2">
                  <div className="rounded-2xl bg-gray-50 p-4">
                    <p className="text-sm text-gray-500">Lokasi Lahan</p>
                    <p className="text-lg font-bold">{lahan.lokasi}</p>
                  </div>

                  <div className="rounded-2xl bg-gray-50 p-4">
                    <p className="text-sm text-gray-500">Status</p>
                    <p className="text-lg font-bold">{formatStatus(lahan.status)}</p>
                  </div>

                  <div className="rounded-2xl bg-gray-50 p-4">
                    <p className="text-sm text-gray-500">Luas Lahan</p>
                    <p className="text-lg font-bold">{lahan.luas} m²</p>
                  </div>

                  <div className="rounded-2xl bg-gray-50 p-4">
                    <p className="text-sm text-gray-500">Tanggal Mulai Tanam</p>
                    <p className="text-lg font-bold">
                      {formatDateId(jadwalTerbaru?.tanggal_mulai)}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-gray-50 p-4">
                    <p className="text-sm text-gray-500">Estimasi Panen</p>
                    <p className="text-lg font-bold">
                      {panenEstimasi ? panenEstimasi.tanggalText : "-"}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-gray-50 p-4">
                    <p className="text-sm text-gray-500">Siap Tanam Kembali</p>
                    <p className="text-lg font-bold">
                      {siapTanamKembali ? siapTanamKembali.tanggalText : "-"}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-gray-50 p-4">
                    <p className="text-sm text-gray-500">Estimasi Hasil Gabah</p>
                    <p className="text-lg font-bold">
                      {estimasiGabahMin && estimasiGabahMax
                        ? `${formatNumber(estimasiGabahMin)} - ${formatNumber(
                            estimasiGabahMax
                          )} kg`
                        : "-"}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-gray-50 p-4">
                    <p className="text-sm text-gray-500">Varietas Padi</p>
                    <p className="text-lg font-bold">
                      {jadwalTerbaru?.varietas_padi || "-"}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-gray-50 p-4">
                    <p className="text-sm text-gray-500">Jumlah Benih</p>
                    <p className="text-lg font-bold">
                      {jadwalTerbaru?.jumlah_benih
                        ? `${formatNumber(jadwalTerbaru.jumlah_benih)} kg`
                        : "-"}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-gray-50 p-4 md:col-span-2">
                    <p className="mb-2 text-sm text-gray-500">Catatan</p>
                    <p className="whitespace-pre-line text-sm leading-relaxed text-gray-800">
                      {jadwalTerbaru?.catatan || "Belum ada catatan."}
                    </p>
                  </div>
                </div>
              )}
            </section>

            <section className="mb-6 rounded-2xl border bg-white p-5 shadow-sm">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-bold">Aktivitas Terbaru</h2>
                  <p className="text-sm text-gray-500">
                    Log aktivitas terbaru pada lahan ini.
                  </p>
                </div>

                <button
                  onClick={() => router.push("/log")}
                  className="rounded-xl border px-4 py-2 text-sm font-medium hover:bg-gray-50"
                >
                  Lihat Semua Log
                </button>
              </div>

              {aktivitasTerbaru.length === 0 ? (
                <p className="rounded-xl bg-gray-50 p-4 text-sm text-gray-500">
                  Belum ada aktivitas yang dicatat.
                </p>
              ) : (
                <div className="space-y-3">
                  {aktivitasTerbaru.map((log) => (
                    <article
                      key={log.id}
                      onClick={() => router.push(`/log/${log.id}`)}
                      className="cursor-pointer rounded-2xl border bg-gray-50 p-4 transition hover:border-green-300 hover:bg-green-50"
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <h3 className="font-bold">{log.jenis_aktivitas}</h3>
                          <p className="text-sm text-gray-500">
                            {formatDateId(log.tanggal)} • Dicatat{" "}
                            {formatDateTimeId(log.created_at)}
                          </p>
                        </div>

                        {log.bukti && (
                          <span className="w-fit rounded-full bg-white px-3 py-1 text-xs font-medium text-green-700">
                            Ada bukti
                          </span>
                        )}
                      </div>

                      <p className="mt-2 line-clamp-2 text-sm text-gray-700">
                        {log.deskripsi || "-"}
                      </p>
                    </article>
                  ))}
                </div>
              )}
            </section>

            {isPengelola && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <button
                  onClick={openEditModal}
                  className="rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700"
                >
                  Edit Jadwal
                </button>

                <button
                  onClick={() => router.push(`/log/tambah?lahan_id=${lahanId}`)}
                  className="rounded-xl bg-green-600 px-4 py-3 font-semibold text-white hover:bg-green-700"
                >
                  Tambah Log Aktivitas
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {showEditModal && jadwalTerbaru && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-4">
              <p className="text-sm font-medium text-blue-700">Edit Jadwal</p>
              <h2 className="text-xl font-bold">Ubah Jadwal Tanam</h2>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              {currentTimelineIndex <= 0 ? (
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Tanggal Mulai Tanam
                  </label>

                  <input
                    type="date"
                    max={editMaxDate}
                    value={editTanggalMulai}
                    onChange={(e) => setEditTanggalMulai(e.target.value)}
                    className="w-full rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              ) : (
                <div className="space-y-4">
                  {editableTimelineItems.map((item) => (
                    <div key={item.key}>
                      <label className="mb-1 block text-sm font-medium">
                        Tanggal Akhir {item.label}
                      </label>

                      <input
                        type="date"
                        max={editMaxDate}
                        value={editTimelineDates[item.key] || ""}
                        onChange={(e) =>
                          setEditTimelineDates((prev) => ({
                            ...prev,
                            [item.key]: e.target.value,
                          }))
                        }
                        className="w-full rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                      />

                      <p className="mt-1 text-xs text-gray-500">
                        Saat ini: {item.tanggalText}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              <div>
                <label className="mb-1 block text-sm font-medium">
                  Varietas Padi
                </label>

                <input
                  type="text"
                  value={editVarietasPadi}
                  onChange={(e) => setEditVarietasPadi(e.target.value)}
                  className="w-full rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  Jumlah Benih
                </label>

                <div className="flex overflow-hidden rounded-xl border focus-within:ring-2 focus-within:ring-blue-500">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={editJumlahBenih}
                    onChange={(e) => {
                      const value = e.target.value
                      if (/^[0-9]*[.,]?[0-9]*$/.test(value)) {
                        setEditJumlahBenih(value)
                      }
                    }}
                    className="w-full px-3 py-2 outline-none"
                  />

                  <span className="flex items-center border-l bg-gray-50 px-3 text-sm text-gray-500">
                    kg
                  </span>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Catatan</label>

                <textarea
                  value={editCatatan}
                  onChange={(e) => setEditCatatan(e.target.value)}
                  className="min-h-24 w-full rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex flex-col gap-2 pt-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="w-full rounded-xl border px-4 py-2 font-medium hover:bg-gray-50 sm:w-1/2"
                >
                  Batal
                </button>

                <button
                  type="submit"
                  disabled={savingEdit}
                  className="w-full rounded-xl bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700 disabled:opacity-60 sm:w-1/2"
                >
                  {savingEdit ? "Menyimpan..." : "Simpan Perubahan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  )
}