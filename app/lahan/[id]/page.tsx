"use client"

import { Suspense, useEffect, useMemo, useRef, useState } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { syncLahanStatus } from "@/lib/syncLahanStatus"
import RiceShareTopNav from "@/components/RiceShareTopNav"
import {
  ArrowLeft,
  CalendarDays,
  ClipboardList,
  Leaf,
  MapPinned,
  Sprout,
  Wheat,
  PencilLine,
  ChevronRight,
} from "lucide-react"

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
      return "bg-emerald-100 text-emerald-700 border-emerald-200"

    case "belum_digunakan":
      return "bg-slate-100 text-slate-700 border-slate-200"

    default:
      return "bg-gray-100 text-gray-700 border-gray-200"
  }
}

function formatTimelineDate(startDate: string, endDate: string) {
  if (startDate === endDate) return formatDateId(endDate)

  return `${formatDateId(startDate)} – ${formatDateId(endDate)}`
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
      doesLogMatchTimeline(label, log.jenis_aktivitas) &&
      !!log.tanggal &&
      log.tanggal >= startDate
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

      if (endDate < startDate) {
        startDate = endDate
      }
    }

    items.push({
      key: template.key,
      label: template.label,
      startDate,
      endDate,
      tanggalText: formatTimelineDate(startDate, endDate),
      status: getTimelineStatus(
        today,
        startDate,
        endDate,
        template.label,
        aktivitasLogs
      ),
    })
  }

  return items
}

function getCurrentStage(timeline: TimelineItem[]) {
  if (timeline.length === 0) return "Belum ada siklus tanam"

  const current = timeline.find((item) => item.status === "berjalan")

  if (current) return current.label

  return "Menunggu tahap berikutnya"
}

function getTimelineDotStyle(item: TimelineItem, today: string) {
  if (item.status === "selesai") {
    return "bg-green-600 border-green-600 text-white"
  }

  if (item.status === "berjalan") {
    return "bg-green-100 border-green-500 text-green-700"
  }

  if (item.endDate < today) {
    return "bg-green-100 border-green-500 text-green-700"
  }

  return "bg-white border-gray-300 text-gray-400"
}

function normalizeActivityText(value?: string | null) {
  return (value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

function doesLogMatchTimeline(label: string, logType: string) {
  const normalizedLabel = normalizeActivityText(label)
  const normalizedLogType = normalizeActivityText(logType)

  if (!normalizedLabel || !normalizedLogType) return false
  if (normalizedLabel === normalizedLogType) return true

  const aliases: Record<string, string[]> = {
    "Mulai Tanam": ["mulai tanam", "tanam", "penanaman"],
    "Cek Adaptasi Bibit": ["cek adaptasi bibit", "adaptasi bibit", "cek bibit", "bibit"],
    "Pemupukan 1": ["pemupukan 1", "pupuk 1", "pemupukan pertama"],
    "Pantau Pertumbuhan Awal": ["pantau pertumbuhan awal", "pantau pertumbuhan", "pertumbuhan awal", "pantau"],
    "Persiapan Pengendalian Gulma": ["persiapan pengendalian gulma", "pengendalian gulma", "persiapan gulma"],
    "Bersihkan Gulma": ["bersihkan gulma", "bersih gulma", "pembersihan gulma"],
    "Pemupukan 2": ["pemupukan 2", "pupuk 2", "pemupukan kedua"],
    "Perawatan Lanjutan": ["perawatan lanjutan", "perawatan", "pemeliharaan lanjutan"],
    "Cek Hama": ["cek hama", "pengecekan hama", "pengendalian hama"],
    "Menjelang Panen": ["menjelang panen", "persiapan panen", "pra panen"],
    "Panen Estimasi": ["panen estimasi", "panen", "input panen", "hasil panen"],
    "Masa Istirahat": ["masa istirahat", "istirahat"],
    "Siap Tanam Kembali": ["siap tanam kembali", "siap tanam", "tanam kembali"],
  }

  return (aliases[label] || []).some((alias) => {
    return normalizeActivityText(alias) === normalizedLogType
  })
}

function getTimelineItemIndex(key: string) {
  return timelineTemplates.findIndex((template) => template.key === key)
}

function getActiveTimelineIndex(timeline: TimelineItem[]) {
  if (timeline.length === 0) return -1

  const currentIndex = timeline.findIndex(
    (item) => item.status === "berjalan"
  )

  const fallbackIndex = timeline.findIndex(
    (item) => item.status === "belum"
  )

  return currentIndex >= 0
    ? currentIndex
    : fallbackIndex >= 0
    ? fallbackIndex
    : timeline.length - 1
}

function getEditableTimelineItems(timeline: TimelineItem[]) {
  const activeIndex = getActiveTimelineIndex(timeline)

  if (activeIndex < 0) return []

  return timeline.filter((_, index) => {
    return Math.abs(index - activeIndex) <= 1
  })
}

function getTimelineEditRange(
  timeline: TimelineItem[],
  item: TimelineItem,
  today: string
) {
  const activeIndex = getActiveTimelineIndex(timeline)
  const itemIndex = getTimelineItemIndex(item.key)

  const fallbackMin = item.startDate
  const fallbackMax = item.endDate

  if (activeIndex < 0 || itemIndex < 0) {
    return {
      min: fallbackMin,
      max: fallbackMax,
      type: "range" as const,
      description: "Tanggal edit mengikuti range tahap ini.",
    }
  }

  if (itemIndex < activeIndex) {
    return {
      min: item.startDate,
      max: today,
      type: "previous" as const,
      description:
        "Tahap sebelumnya adalah koreksi data. Tanggal maksimal adalah hari ini.",
    }
  }

  if (itemIndex === activeIndex) {
    return {
      min: item.startDate,
      max: item.endDate,
      type: "current" as const,
      description:
        "Tahap saat ini bisa disesuaikan sampai akhir range tahap ini.",
    }
  }

  return {
    min: today,
    max: item.endDate,
    type: "next" as const,
    description:
      "Tahap selanjutnya bisa dimajukan paling awal ke hari ini.",
  }
}

function isDateWithinRange(date: string, min: string, max: string) {
  if (!date || !min || !max) return false

  return date >= min && date <= max
}

function getPanenEstimasiEndDate(timeline: TimelineItem[]) {
  return timeline.find((item) => item.key === "panen_estimasi")?.endDate || null
}


function DetailLahanContent() {
  const router = useRouter()

  const params = useParams()
  const searchParams = useSearchParams()

  const lahanId = params.id as string

  const shouldOpenEditJadwal =
    searchParams.get("open_edit_jadwal") === "1"

  const hasOpenedEditFromUrl = useRef(false)

  const [user, setUser] = useState<UserProfile | null>(null)

  const [checkingUser, setCheckingUser] = useState(true)

  const [loadingData, setLoadingData] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const [lahan, setLahan] = useState<LahanDetail | null>(null)

  const [activeTab, setActiveTab] =
    useState<ActiveTab>("timeline")

  const [showEditModal, setShowEditModal] = useState(false)
  const [savingEdit, setSavingEdit] = useState(false)

  const [editTanggalMulai, setEditTanggalMulai] = useState("")
  const [editTimelineDates, setEditTimelineDates] = useState<Record<string, string>>({})
  const [editVarietasPadi, setEditVarietasPadi] = useState("")
  const [editJumlahBenih, setEditJumlahBenih] = useState("")
  const [editCatatan, setEditCatatan] = useState("")

  const today = getTodayDateInputValue()

  const fetchLahanDetail = async (showRefresh = false) => {
    if (showRefresh) {
      setRefreshing(true)
    } else {
      setLoadingData(true)
    }

    await syncLahanStatus()

    const { data: lahanData } = await supabase
      .from("lahan")
      .select("id, lokasi, luas, status")
      .eq("id", lahanId)
      .single()

    const { data: jadwalData } = await supabase
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

    const { data: logData } = await supabase
      .from("aktivitas_log")
      .select(`
        id,
        jenis_aktivitas,
        tanggal,
        deskripsi,
        bukti,
        created_at
      `)
      .eq("lahan_id", lahanId)
      .order("tanggal", { ascending: false })

   if (lahanData) {
  setLahan({
    id: lahanData.id,
    lokasi: lahanData.lokasi,
    luas: lahanData.luas,
    status: lahanData.status as LahanDetail["status"],
    jadwal_tanam: (jadwalData || []).map((item) => ({
      ...item,
      timeline_overrides:
        item.timeline_overrides &&
        typeof item.timeline_overrides === "object"
          ? (item.timeline_overrides as TimelineOverrides)
          : {},
    })),
    aktivitas_log: logData || [],
  })
}

    setLoadingData(false)
    setRefreshing(false)
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
  if (!checkingUser && lahanId) {
    fetchLahanDetail()
  }
}, [checkingUser, lahanId])

  const jadwalTerbaru = lahan?.jadwal_tanam?.[0] 

  const aktivitasLogs = useMemo(
    () => lahan?.aktivitas_log || [],
    [lahan?.aktivitas_log]
  )

  const timeline = useMemo(() => {
    if (!jadwalTerbaru?.tanggal_mulai) return []

    return buildTimeline(
      jadwalTerbaru.tanggal_mulai,
      today,
      jadwalTerbaru.timeline_overrides || {},
      aktivitasLogs
    )
  }, [jadwalTerbaru, aktivitasLogs, today])

  const editableTimelineItems = useMemo(() => {
    return getEditableTimelineItems(timeline)
  }, [timeline])

  const editableTimelineDateItems = useMemo(() => {
    return editableTimelineItems.filter(
      (item) => item.key !== "mulai_tanam"
    )
  }, [editableTimelineItems])

  const canEditTanggalMulai = editableTimelineItems.some(
    (item) => item.key === "mulai_tanam"
  )

const openEditModal = () => {
        
  if (!jadwalTerbaru) {
    alert("Belum ada jadwal tanam yang bisa diedit.")
    return
  }

  const initialEditDates: Record<string, string> = {}

  editableTimelineDateItems.forEach((item) => {
    initialEditDates[item.key] = item.endDate
  })

  setEditTanggalMulai(jadwalTerbaru.tanggal_mulai || "")
  setEditTimelineDates(initialEditDates)
  setEditVarietasPadi(jadwalTerbaru.varietas_padi || "")
  setEditJumlahBenih(
    jadwalTerbaru.jumlah_benih
      ? String(jadwalTerbaru.jumlah_benih)
      : ""
  )
  setEditCatatan(jadwalTerbaru.catatan || "")

  setShowEditModal(true)
}
  const panenEstimasi = timeline.find(
    (item) => item.key === "panen_estimasi"
  )

  const hariKe =
    jadwalTerbaru?.tanggal_mulai &&
    lahan?.status
      ? differenceInDays(
          jadwalTerbaru.tanggal_mulai,
          today
        )
        
      : null
useEffect(() => {
  if (
    shouldOpenEditJadwal &&
    !hasOpenedEditFromUrl.current &&
    jadwalTerbaru &&
    timeline.length > 0
  ) {
    hasOpenedEditFromUrl.current = true
    openEditModal()
    router.replace(`/lahan/${lahanId}`)
  }
}, [
  shouldOpenEditJadwal,
  jadwalTerbaru?.id,
  timeline.length,
  router,
  lahanId,
])
      const handleSaveEdit = async () => {
  try {
    setSavingEdit(true)

    if (!jadwalTerbaru) return

    const nextTanggalMulai = canEditTanggalMulai
      ? editTanggalMulai
      : jadwalTerbaru.tanggal_mulai

    if (!nextTanggalMulai) {
      alert("Tanggal mulai tidak boleh kosong.")
      return
    }

    const nextTimelineOverrides: TimelineOverrides = {
      ...(jadwalTerbaru.timeline_overrides || {}),
    }

    const changedIndexes: number[] = []

    if (
      canEditTanggalMulai &&
      nextTanggalMulai !== jadwalTerbaru.tanggal_mulai
    ) {
      changedIndexes.push(0)
    }

    for (const item of editableTimelineDateItems) {
      const nextDate = editTimelineDates[item.key] || ""
      const editRange = getTimelineEditRange(timeline, item, today)

      if (!nextDate) {
        if (nextTimelineOverrides[item.key]) {
          delete nextTimelineOverrides[item.key]
          changedIndexes.push(getTimelineItemIndex(item.key))
        }

        continue
      }

      if (!isDateWithinRange(nextDate, editRange.min, editRange.max)) {
        alert(
          `${item.label} harus berada pada rentang ${formatDateId(
            editRange.min
          )} sampai ${formatDateId(editRange.max)}.`
        )
        return
      }

      if (nextDate !== item.endDate) {
        nextTimelineOverrides[item.key] = nextDate
        changedIndexes.push(getTimelineItemIndex(item.key))
      }
    }

    const lastChangedIndex =
      changedIndexes.length > 0
        ? Math.max(...changedIndexes.filter((index) => index >= 0))
        : -1

    if (lastChangedIndex >= 0) {
      timelineTemplates.forEach((template, index) => {
        if (index > lastChangedIndex) {
          delete nextTimelineOverrides[template.key]
        }
      })
    }

    const recalculatedTimeline = buildTimeline(
      nextTanggalMulai,
      today,
      nextTimelineOverrides,
      aktivitasLogs
    )

    const nextTanggalSelesai =
      getPanenEstimasiEndDate(recalculatedTimeline) ||
      jadwalTerbaru.tanggal_selesai

    const { error } = await supabase
      .from("jadwal_tanam")
      .update({
        tanggal_mulai: nextTanggalMulai,
        tanggal_selesai: nextTanggalSelesai,
        varietas_padi: editVarietasPadi,
        jumlah_benih:
          editJumlahBenih.trim() === ""
            ? null
            : Number(editJumlahBenih),
        catatan: editCatatan,
        timeline_overrides: nextTimelineOverrides,
      })
      .eq("id", jadwalTerbaru.id)

    if (error) {
      console.log("UPDATE JADWAL ERROR:", error)
      alert(
        [
          "Gagal menyimpan perubahan jadwal.",
          error.message ? `Pesan: ${error.message}` : "",
          error.details ? `Detail: ${error.details}` : "",
          error.hint ? `Hint: ${error.hint}` : "",
          error.code ? `Kode: ${error.code}` : "",
        ]
          .filter(Boolean)
          .join("\n")
      )
      return
    }

    await syncLahanStatus()
    await fetchLahanDetail()

    setShowEditModal(false)

    alert("Jadwal berhasil diperbarui dan timeline sudah direkalkulasi.")
  } catch (error) {
    console.error(error)
    alert("Gagal menyimpan perubahan")
  } finally {
    setSavingEdit(false)
  }
}

      

  if (checkingUser) {
    return (
      <main className="min-h-screen bg-[#f7faf5] p-6">
        Loading...
      </main>
    )
  }

  if (!user) return null

  const isPengelola = user.role === "pengelola"

  return (
    <main className="min-h-screen bg-[#f7faf5] text-gray-950">
      <RiceShareTopNav user={user} />

      <div className="pb-28 lg:pb-10">
        <div className="mx-auto w-full max-w-7xl px-4 py-5 md:px-6 md:py-6">

        {/* HEADER */}
        <section className="mb-6 rounded-[30px] border border-gray-100 bg-white p-5 shadow-[0_10px_35px_rgba(15,23,42,0.07)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold text-green-700">
                RiceShare
              </p>

              <h1 className="mt-1 text-3xl font-bold">
                {lahan ? `Lahan ${lahan.lokasi}` : "Detail Lahan"}
              </h1>

              <p className="mt-2 text-sm text-gray-500">
                Pantau timeline pertanian, progres tanam, estimasi panen,
                dan aktivitas terbaru pada lahan.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                onClick={() => router.push("/lahan")}
                className="flex items-center justify-center gap-2 rounded-2xl border border-green-100 bg-white px-5 py-3 text-sm font-semibold text-gray-700 transition-all hover:bg-green-50"
              >
                <ArrowLeft size={18} />
                Lahan
              </button>

              {isPengelola && (
                <button
                  onClick={() => router.push(`/log/tambah?lahan_id=${lahanId}`)}
                  className="flex items-center justify-center gap-2 rounded-2xl bg-green-600 px-5 py-3 text-sm font-semibold text-white shadow-lg transition-all hover:scale-[1.02]"
                >
                  <ClipboardList size={18} />
                  Tambah Log
                </button>
              )}
            </div>
          </div>
        </section>

        {loadingData ? (
          <section className="rounded-[30px] border border-green-100 bg-white/80 p-6 shadow-xl backdrop-blur-xl">
            <p className="text-sm text-gray-500">
              Memuat detail lahan...
            </p>
          </section>
        ) : !lahan ? (
          <section className="rounded-[30px] border border-green-100 bg-white/80 p-8 text-center shadow-xl backdrop-blur-xl">

            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
              🌾
            </div>

            <h2 className="text-xl font-bold">
              Data Lahan Tidak Ditemukan
            </h2>

            <p className="mt-2 text-sm text-gray-500">
              Detail lahan tidak tersedia.
            </p>
          </section>
        ) : (
          <>
            {/* SUMMARY */}
            <section className="mb-6 grid grid-cols-2 gap-4 xl:grid-cols-4">

              <div className="rounded-[28px] border border-green-200 bg-white/80 p-5 shadow-xl backdrop-blur-xl">

                <div className="flex items-center justify-between">

                  <div>
                    <p className="text-sm font-medium text-gray-500">
                      Status
                    </p>

                    <h2 className="mt-2 text-xl font-bold text-green-700">
                      {formatStatus(lahan.status)}
                    </h2>
                  </div>

                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-green-100 text-green-700">
                    <Sprout size={28} />
                  </div>
                </div>
              </div>

              <div className="rounded-[28px] border border-yellow-200 bg-white/80 p-5 shadow-xl backdrop-blur-xl">

                <div className="flex items-center justify-between">

                  <div>
                    <p className="text-sm font-medium text-gray-500">
                      Hari Tanam
                    </p>

                    <h2 className="mt-2 text-3xl font-bold text-yellow-700">
                      {hariKe !== null ? hariKe : "-"}
                    </h2>
                  </div>

                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-yellow-100 text-yellow-700">
                    <CalendarDays size={28} />
                  </div>
                </div>
              </div>

              <div className="rounded-[28px] border border-blue-200 bg-white/80 p-5 shadow-xl backdrop-blur-xl">

                <div className="flex items-center justify-between">

                  <div>
                    <p className="text-sm font-medium text-gray-500">
                      Tahap Saat Ini
                    </p>

                    <h2 className="mt-2 text-lg font-bold text-blue-700">
                      {getCurrentStage(timeline)}
                    </h2>
                  </div>

                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-100 text-blue-700">
                    <Leaf size={28} />
                  </div>
                </div>
              </div>

              <div className="rounded-[28px] border border-emerald-200 bg-white/80 p-5 shadow-xl backdrop-blur-xl">

                <div className="flex items-center justify-between">

                  <div>
                    <p className="text-sm font-medium text-gray-500">
                      Estimasi Panen
                    </p>

                    <h2 className="mt-2 text-base font-bold text-emerald-700">
                      {panenEstimasi
                        ? panenEstimasi.tanggalText
                        : "-"}
                    </h2>
                  </div>

                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                    <Wheat size={28} />
                  </div>
                </div>
              </div>
            </section>

            {/* TABS */}
            <section className="mb-6 overflow-hidden rounded-[30px] border border-green-100 bg-white/80 shadow-xl backdrop-blur-xl">

              <div className="flex border-b border-green-100">

                <button
                  onClick={() => setActiveTab("timeline")}
                  className={`flex-1 px-5 py-4 text-sm font-semibold transition-all ${
                    activeTab === "timeline"
                      ? "bg-green-50 text-green-700"
                      : "text-gray-500 hover:bg-gray-50"
                  }`}
                >
                  Timeline
                </button>

                <button
                  onClick={() => setActiveTab("detail")}
                  className={`flex-1 px-5 py-4 text-sm font-semibold transition-all ${
                    activeTab === "detail"
                      ? "bg-green-50 text-green-700"
                      : "text-gray-500 hover:bg-gray-50"
                  }`}
                >
                  Detail
                </button>
              </div>

              {activeTab === "timeline" && (
                <div className="grid grid-cols-1 gap-6 p-5 lg:grid-cols-3">

                  <div className="lg:col-span-2">

                    <h2 className="mb-5 text-lg font-bold">
                      Progress Musim Tanam
                    </h2>

                    {timeline.length === 0 ? (
                      <div className="rounded-2xl bg-green-50 p-5 text-sm text-gray-500">
                        Timeline belum tersedia.
                      </div>
                    ) : (
                      <div className="relative pl-8">

                        <div className="absolute left-[14px] top-2 h-[calc(100%-20px)] w-[2px] bg-green-200" />

                        <div className="space-y-6">

                          {timeline.map((item) => (
                            <div
                              key={item.key}
                              className="relative"
                            >

                              <div
                                className={`absolute -left-8 top-1 flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-bold ${getTimelineDotStyle(
                                  item,
                                  today
                                )}`}
                              >
                                {item.status === "selesai"
                                  ? "✓"
                                  : ""}
                              </div>

                              <div className="rounded-2xl border border-green-100 bg-white p-4 shadow-sm">

                                <div className="flex items-start justify-between gap-3">

                                  <div>
                                    <h3 className="font-bold text-gray-800">
                                      {item.label}
                                    </h3>

                                    <p className="mt-1 text-sm text-gray-500">
                                      {item.tanggalText}
                                    </p>
                                  </div>

                                  <span
                                    className={`rounded-full border px-3 py-1 text-xs font-semibold ${getStatusStyle(
                                      item.status === "berjalan"
                                        ? "masa_tanam_aktif"
                                        : item.status ===
                                          "selesai"
                                        ? "siap_tanam_kembali"
                                        : "belum_digunakan"
                                    )}`}
                                  >
                                    {item.status}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* SIDEBAR */}
                  <aside className="space-y-4">

                    <div className="rounded-[28px] border border-green-100 bg-white p-5 shadow-sm">

                      <h2 className="mb-4 text-lg font-bold">
                        Informasi Lahan
                      </h2>

                      <div className="space-y-4">

                        <div className="rounded-2xl bg-green-50 p-4">
                          <p className="text-sm text-gray-500">
                            Varietas Padi
                          </p>

                          <p className="mt-1 font-bold">
                            {jadwalTerbaru?.varietas_padi ||
                              "-"}
                          </p>
                        </div>

                        <div className="rounded-2xl bg-yellow-50 p-4">
                          <p className="text-sm text-gray-500">
                            Jumlah Benih
                          </p>

                          <p className="mt-1 font-bold">
                            {jadwalTerbaru?.jumlah_benih
                              ? `${formatNumber(
                                  jadwalTerbaru.jumlah_benih
                                )} kg`
                              : "-"}
                          </p>
                        </div>

                        <div className="rounded-2xl bg-blue-50 p-4">
                          <p className="text-sm text-gray-500">
                            Luas Lahan
                          </p>

                          <p className="mt-1 font-bold">
                            {lahan.luas} m²
                          </p>
                        </div>
                      </div>
                    </div>

                    {isPengelola && (
                      <div className="space-y-3">

                        <button
                           onClick={openEditModal}
                          
                          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-500 to-cyan-600 px-5 py-3 text-sm font-semibold text-white shadow-lg transition-all hover:scale-[1.02]"
                        >
                          <PencilLine size={18} />
                          Edit Jadwal
                        </button>

                        <button
                          onClick={() =>
                            router.push(
                              `/log/tambah?lahan_id=${lahanId}`
                            )
                          }
                          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-green-500 to-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-lg transition-all hover:scale-[1.02]"
                        >
                          <ClipboardList size={18} />
                          Tambah Log Aktivitas
                        </button>
                      </div>
                    )}
                  </aside>
                </div>
              )}

              {activeTab === "detail" && (
                <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2">

                  {[
                    {
                      label: "Lokasi Lahan",
                      value: lahan.lokasi,
                    },
                    {
                      label: "Status",
                      value: formatStatus(lahan.status),
                    },
                    {
                      label: "Tanggal Mulai",
                      value: formatDateId(
                        jadwalTerbaru?.tanggal_mulai
                      ),
                    },
                    {
                      label: "Estimasi Panen",
                      value: panenEstimasi?.tanggalText || "-",
                    },
                    {
                      label: "Varietas Padi",
                      value:
                        jadwalTerbaru?.varietas_padi || "-",
                    },
                    {
                      label: "Jumlah Benih",
                      value: jadwalTerbaru?.jumlah_benih
                        ? `${formatNumber(
                            jadwalTerbaru.jumlah_benih
                          )} kg`
                        : "-",
                    },
                  ].map((item, index) => (
                    <div
                      key={index}
                      className="rounded-[24px] bg-white p-5 shadow-sm"
                    >
                      <p className="text-sm text-gray-500">
                        {item.label}
                      </p>

                      <p className="mt-2 text-lg font-bold text-gray-800">
                        {item.value}
                      </p>
                    </div>
                  ))}

                  <div className="rounded-[24px] bg-white p-5 shadow-sm md:col-span-2">

                    <p className="text-sm text-gray-500">
                      Catatan
                    </p>

                    <p className="mt-3 whitespace-pre-line leading-relaxed text-gray-700">
                      {jadwalTerbaru?.catatan ||
                        "Belum ada catatan."}
                    </p>
                  </div>
                </div>
              )}
            </section>

            {/* LOG */}
            <section className="rounded-[30px] border border-green-100 bg-white/80 p-5 shadow-xl backdrop-blur-xl">

              <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

                <div>
                  <h2 className="text-xl font-bold">
                    Aktivitas Terbaru
                  </h2>

                  <p className="mt-1 text-sm text-gray-500">
                    Aktivitas terbaru pada lahan ini.
                  </p>
                </div>

                <button
                  onClick={() => router.push("/log")}
                  className="flex items-center justify-center gap-2 rounded-2xl border border-green-100 bg-white px-5 py-3 text-sm font-semibold text-gray-700 transition-all hover:bg-green-50"
                >
                  Semua Log
                  <ChevronRight size={18} />
                </button>
              </div>

              {aktivitasLogs.length === 0 ? (
                <div className="rounded-2xl bg-green-50 p-5 text-sm text-gray-500">
                  Belum ada aktivitas.
                </div>
              ) : (
                <div className="space-y-4">

                  {aktivitasLogs.slice(0, 5).map((log) => (
                    <article
                      key={log.id}
                      onClick={() =>
                        router.push(`/log/${log.id}`)
                      }
                      className="cursor-pointer rounded-[24px] border border-green-100 bg-white p-5 shadow-sm transition-all hover:-translate-y-1 hover:border-green-300 hover:bg-green-50"
                    >

                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">

                        <div>
                          <h3 className="font-bold text-gray-800">
                            {log.jenis_aktivitas}
                          </h3>

                          <p className="mt-1 text-sm text-gray-500">
                            {formatDateId(log.tanggal)} •{" "}
                            {formatDateTimeId(
                              log.created_at
                            )}
                          </p>
                        </div>

                        {log.bukti && (
                          <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
                            Ada Bukti
                          </span>
                        )}
                      </div>

                      <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-gray-700">
                        {log.deskripsi || "-"}
                      </p>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
        </div>
      </div>
      {showEditModal && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
    <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">

      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-bold">
          Edit Jadwal Tanam
        </h2>

        <button
          onClick={() => setShowEditModal(false)}
          className="rounded-xl px-3 py-2 hover:bg-gray-100"
        >
          ✕
        </button>
      </div>

      <div className="space-y-4">

  <div>
    <label className="mb-1 block text-sm font-medium">
      Tanggal Mulai
    </label>

    <input
      type="date"
      value={editTanggalMulai}
      onChange={(e) =>
        setEditTanggalMulai(e.target.value)
      }
      disabled={!canEditTanggalMulai}
      className="w-full rounded-xl border p-3 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500"
    />

    {!canEditTanggalMulai && (
      <p className="mt-2 text-xs text-gray-500">
        Tanggal mulai dikunci karena tahap Mulai Tanam tidak berada dalam rentang edit saat ini.
      </p>
    )}
  </div>

  <div>
    <label className="mb-1 block text-sm font-medium">
      Varietas Padi
    </label>

    <input
      value={editVarietasPadi}
      onChange={(e) =>
        setEditVarietasPadi(e.target.value)
      }
      className="w-full rounded-xl border p-3"
    />
  </div>

  <div>
    <label className="mb-1 block text-sm font-medium">
      Jumlah Benih
    </label>

    <input
      type="number"
      value={editJumlahBenih}
      onChange={(e) =>
        setEditJumlahBenih(e.target.value)
      }
      className="w-full rounded-xl border p-3"
    />
  </div>

  <div>
    <label className="mb-1 block text-sm font-medium">
      Catatan
    </label>

    <textarea
      value={editCatatan}
      onChange={(e) =>
        setEditCatatan(e.target.value)
      }
      rows={4}
      className="w-full rounded-xl border p-3"
    />
  </div>
<div className="space-y-3">
  {editableTimelineDateItems.length === 0 ? (
    <div className="rounded-2xl border border-dashed border-gray-200 p-4 text-sm text-gray-500">
      Tidak ada tahap timeline yang bisa diedit saat ini.
    </div>
  ) : (
    editableTimelineDateItems.map((item) => {
      const editRange = getTimelineEditRange(timeline, item, today)

      return (
        <div key={item.key}>
          <div className="mb-1 flex items-center justify-between gap-3">
            <label className="block text-sm text-gray-600">
              {item.label}
            </label>

            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
              {item.status}
            </span>
          </div>

          <input
            type="date"
            value={editTimelineDates[item.key] || ""}
            min={editRange.min}
            max={editRange.max}
            onChange={(e) =>
              setEditTimelineDates((prev) => ({
                ...prev,
                [item.key]: e.target.value,
              }))
            }
            className="w-full rounded-xl border p-3"
          />

          <p className="mt-1 text-xs text-gray-500">
            Jadwal saat ini: {item.tanggalText}
          </p>

          <p className="mt-1 text-xs text-green-700">
            Batas edit: {formatDateId(editRange.min)} - {formatDateId(editRange.max)}
          </p>

          <p className="mt-1 text-xs text-gray-500">
            {editRange.description}
          </p>
        </div>
      )
    })
  )}
</div>
<div className="mt-6 flex justify-end gap-3">

    <button
      type="button"
      onClick={() => setShowEditModal(false)}
      className="rounded-xl border border-gray-300 px-5 py-3 font-medium text-gray-700 hover:bg-gray-100"
    >
      Batal
    </button>

    <button
      type="button"
      onClick={handleSaveEdit}
      disabled={savingEdit}
      className="rounded-xl bg-green-600 px-5 py-3 font-medium text-white hover:bg-green-700 disabled:opacity-50"
    >
      {savingEdit ? "Menyimpan..." : "Simpan Perubahan"}
    </button>

  </div>
</div>

    </div>
    
  </div>
  
)}
    </main>
  )
}

export default function DetailLahanPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#f7faf5] p-6 text-gray-950">
          <div className="rounded-3xl bg-white px-8 py-6 shadow-xl">
            <p className="text-lg font-semibold text-green-700">
              Memuat detail lahan...
            </p>
          </div>
        </main>
      }
    >
      <DetailLahanContent />
    </Suspense>
  )
}
