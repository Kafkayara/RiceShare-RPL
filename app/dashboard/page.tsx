"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Droplets,
  Eye,
  Image as ImageIcon,
  Leaf,
  PlusCircle,
  Search,
  Sprout,
  Wheat,
  UsersRound,
  FileText,
  UserCog,
} from "lucide-react"

import { supabase } from "@/lib/supabase"
import { syncLahanStatus } from "@/lib/syncLahanStatus"
import RiceShareTopNav from "@/components/RiceShareTopNav"

type UserProfile = {
  id: string
  nama: string
  email: string
  role: "pemilik" | "pengelola"
}

type TimelineOverrides = Record<string, string>

type TimelineTemplate = {
  key: string
  label: string
  startOffset: number
  endOffset: number
}

type TimelineItem = {
  key: string
  label: string
  startDate: string
  endDate: string
  tanggalText: string
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

type LahanItem = {
  id: string
  lokasi: string
  luas?: number | null
  status: string
  jadwal_tanam?: JadwalTanam[] | null
}

type JadwalTanam = {
  id: string
  lahan_id: string
  tanggal_mulai: string | null
  tanggal_selesai: string | null
  status: string | null
  varietas_padi?: string | null
  jumlah_benih?: number | null
  catatan?: string | null
  timeline_overrides?: TimelineOverrides | null
  created_at?: string | null
  lahan?: {
    id: string
    lokasi: string
    luas?: number | null
    status?: string | null
  } | null
}

type AktivitasLog = {
  id: string
  lahan_id: string
  pengelola_id?: string | null
  tanggal: string | null
  jenis_aktivitas: string
  deskripsi?: string | null
  bukti?: string | null
  created_at?: string | null
  lahan?: {
    lokasi: string
    luas?: number | null
    status?: string | null
  } | null
}

type AgendaItem = {
  id: string
  title: string
  lahan: string
  date: Date
  dateText: string
  status: "today" | "overdue" | "upcoming"
  icon: typeof Leaf
  actionLabel: string
  actionPath: string
}

const monthNames = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
]

const dayLabels = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"]

function toDateOnly(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function parseDate(dateString?: string | null) {
  if (!dateString) return null
  const date = new Date(`${dateString}T00:00:00`)
  return Number.isNaN(date.getTime()) ? null : date
}

function addDays(date: Date, days: number) {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function diffDays(a: Date, b: Date) {
  const oneDay = 1000 * 60 * 60 * 24
  return Math.round((toDateOnly(a).getTime() - toDateOnly(b).getTime()) / oneDay)
}

function formatShortDate(date?: Date | null) {
  if (!date) return "-"
  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
  })
}

function formatTime(dateString?: string | null) {
  if (!dateString) return "08.00"
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return "08.00"

  return date.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  })
}

function getGreeting() {
  const hour = new Date().getHours()

  if (hour < 11) return "Selamat pagi"
  if (hour < 15) return "Selamat siang"
  if (hour < 18) return "Selamat sore"
  return "Selamat malam"
}

function getLahanCode(lokasi?: string | null) {
  if (!lokasi) return "Lahan"
  return lokasi
}

function getActivityIcon(title: string) {
  const lower = title.toLowerCase()
  if (lower.includes("hama")) return Search
  if (lower.includes("air") || lower.includes("pengairan")) return Droplets
  if (lower.includes("panen")) return Wheat
  return Leaf
}

function toDateInputValue(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")

  return `${year}-${month}-${day}`
}

function addDaysString(dateString: string, days: number) {
  const date = new Date(`${dateString}T00:00:00`)
  date.setDate(date.getDate() + days)
  return toDateInputValue(date)
}

function formatTimelineDate(startDate: string, endDate: string) {
  if (startDate === endDate) {
    const date = parseDate(endDate)
    return date ? formatShortDate(date) : "-"
  }

  const start = parseDate(startDate)
  const end = parseDate(endDate)

  return `${start ? formatShortDate(start) : "-"} - ${end ? formatShortDate(end) : "-"}`
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

      startDate = addDaysString(previousItem.endDate, gapFromPrevious)
      endDate = addDaysString(startDate, duration)
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
    })
  }

  return items
}

function normalizeActivityText(value?: string | null) {
  return (value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

const AKTIVITAS_ALIASES: Record<string, string[]> = {
  mulai_tanam: ["mulai tanam", "tanam", "penanaman"],
  cek_adaptasi_bibit: ["cek adaptasi bibit", "adaptasi bibit", "cek bibit", "bibit"],
  pemupukan_1: ["pemupukan 1", "pupuk 1", "pemupukan pertama"],
  pantau_pertumbuhan_awal: ["pantau pertumbuhan awal", "pantau pertumbuhan", "pertumbuhan awal", "pantau"],
  persiapan_pengendalian_gulma: ["persiapan pengendalian gulma", "pengendalian gulma", "persiapan gulma"],
  bersihkan_gulma: ["bersihkan gulma", "bersih gulma", "pembersihan gulma"],
  pemupukan_2: ["pemupukan 2", "pupuk 2", "pemupukan kedua"],
  perawatan_lanjutan: ["perawatan lanjutan", "perawatan", "pemeliharaan lanjutan"],
  cek_hama: ["cek hama", "pengecekan hama", "pengendalian hama"],
  menjelang_panen: ["menjelang panen", "persiapan panen", "pra panen"],
  panen_estimasi: ["panen estimasi", "panen", "input panen", "hasil panen"],
  masa_istirahat: ["masa istirahat", "istirahat"],
  siap_tanam_kembali: ["siap tanam kembali", "siap tanam", "tanam kembali"],
}

function aktivitasSudahDicatat(
  jenisAktivitas: string,
  templateKey: string,
  templateLabel: string
): boolean {
  const normalizedJenis = normalizeActivityText(jenisAktivitas)
  const normalizedLabel = normalizeActivityText(templateLabel)

  if (!normalizedJenis) return false
  if (normalizedJenis === normalizedLabel) return true

  const aliases = AKTIVITAS_ALIASES[templateKey] || []
  return aliases.some((alias) => normalizeActivityText(alias) === normalizedJenis)
}

function timelineItemSudahDicatat(item: TimelineItem, logs: AktivitasLog[]) {
  return logs.some((log) => {
    return (
      !!log.tanggal &&
      log.tanggal >= item.startDate &&
      aktivitasSudahDicatat(log.jenis_aktivitas, item.key, item.label)
    )
  })
}

function buildAgendaFromJadwal(
  jadwalList: JadwalTanam[],
  today: Date,
  aktivitasLogs: AktivitasLog[]
): AgendaItem[] {
  const tasks: AgendaItem[] = []
  const todayString = toDateInputValue(today)

  const latestByLahan = new Map<string, JadwalTanam>()

  jadwalList.forEach((jadwal) => {
    if (!jadwal.lahan_id || !jadwal.tanggal_mulai) return

    const previous = latestByLahan.get(jadwal.lahan_id)
    const previousTime = previous?.created_at ? new Date(previous.created_at).getTime() : 0
    const currentTime = jadwal.created_at ? new Date(jadwal.created_at).getTime() : 0

    if (!previous || currentTime >= previousTime) {
      latestByLahan.set(jadwal.lahan_id, jadwal)
    }
  })

  latestByLahan.forEach((jadwal) => {
    if (!jadwal.tanggal_mulai) return

    const lahanName = getLahanCode(jadwal.lahan?.lokasi)
    const logsForLahan = aktivitasLogs.filter((log) => log.lahan_id === jadwal.lahan_id)
    const timeline = buildTimeline(
      jadwal.tanggal_mulai,
      jadwal.timeline_overrides || {}
    )

    timeline.forEach((item) => {
      if (item.startDate > todayString) return
      if (timelineItemSudahDicatat(item, logsForLahan)) return

      const isActiveToday =
        item.startDate <= todayString && item.endDate >= todayString
      const isOverdue = item.endDate < todayString

      if (!isActiveToday && !isOverdue) return

      const itemDate = isActiveToday
        ? today
        : parseDate(item.endDate) || today

      tasks.push({
        id: `${jadwal.id}-${item.key}`,
        title: item.label,
        lahan: lahanName,
        date: itemDate,
        dateText: isActiveToday ? "Hari ini" : "Terlewat",
        status: isOverdue ? "overdue" : "today",
        icon: getActivityIcon(item.label),
        actionLabel: "Input Log",
        actionPath: `/log/tambah?lahan_id=${jadwal.lahan_id}`,
      })
    })
  })

  return tasks.sort((a, b) => {
    const statusOrder = { overdue: 0, today: 1, upcoming: 2 }
    return statusOrder[a.status] - statusOrder[b.status] || a.date.getTime() - b.date.getTime()
  })
}

function buildUpcomingFromJadwal(
  jadwalList: JadwalTanam[],
  today: Date,
  aktivitasLogs: AktivitasLog[],
  daysAhead = 7
): AgendaItem[] {
  const tasks: AgendaItem[] = []
  const todayString = toDateInputValue(today)
  const endWindow = addDaysString(todayString, daysAhead)

  const latestByLahan = new Map<string, JadwalTanam>()

  jadwalList.forEach((jadwal) => {
    if (!jadwal.lahan_id || !jadwal.tanggal_mulai) return

    const previous = latestByLahan.get(jadwal.lahan_id)
    const previousTime = previous?.created_at ? new Date(previous.created_at).getTime() : 0
    const currentTime = jadwal.created_at ? new Date(jadwal.created_at).getTime() : 0

    if (!previous || currentTime >= previousTime) {
      latestByLahan.set(jadwal.lahan_id, jadwal)
    }
  })

  latestByLahan.forEach((jadwal) => {
    if (!jadwal.tanggal_mulai) return

    const lahanName = getLahanCode(jadwal.lahan?.lokasi)
    const logsForLahan = aktivitasLogs.filter((log) => log.lahan_id === jadwal.lahan_id)
    const timeline = buildTimeline(
      jadwal.tanggal_mulai,
      jadwal.timeline_overrides || {}
    )

    timeline.forEach((item) => {
      if (timelineItemSudahDicatat(item, logsForLahan)) return

      const isUpcoming =
        item.startDate > todayString &&
        item.startDate <= endWindow

      if (!isUpcoming) return

      const itemDate = parseDate(item.startDate) || today

      tasks.push({
        id: `${jadwal.id}-${item.key}-upcoming`,
        title: item.label,
        lahan: lahanName,
        date: itemDate,
        dateText: formatShortDate(itemDate),
        status: "upcoming",
        icon: getActivityIcon(item.label),
        actionLabel: "Detail",
        actionPath: `/kalender?tanggal=${item.startDate}`,
      })
    })
  })

  return tasks.sort((a, b) => a.date.getTime() - b.date.getTime())
}


function statusLabel(status?: string | null) {
  const labels: Record<string, string> = {
    belum_digunakan: "Belum Digunakan",
    masa_tanam_aktif: "Aktif",
    menjelang_panen: "Siap Panen",
    panen_selesai: "Panen Selesai",
    istirahat: "Istirahat",
    siap_tanam_kembali: "Siap Tanam",
  }

  return labels[status || ""] || "Perhatian"
}

export default function DashboardPage() {
  const router = useRouter()
  const today = useMemo(() => toDateOnly(new Date()), [])
  const [user, setUser] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [lahanList, setLahanList] = useState<LahanItem[]>([])
  const [jadwalList, setJadwalList] = useState<JadwalTanam[]>([])
  const [logList, setLogList] = useState<AktivitasLog[]>([])
  const [pengelolaCount, setPengelolaCount] = useState(0)

  useEffect(() => {
    const savedUser = localStorage.getItem("riceshare_user")

    if (!savedUser) {
      router.push("/")
      return
    }

    setUser(JSON.parse(savedUser))
    fetchDashboard()
  }, [router])

  const fetchDashboard = async () => {
    setLoading(true)
    await syncLahanStatus()

    const { data: lahanData } = await supabase
      .from("lahan")
      .select("id, lokasi, luas, status")
      .order("lokasi", { ascending: true })

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
        timeline_overrides,
        created_at,
        lahan (
          id,
          lokasi,
          luas,
          status
        )
      `)
      .order("tanggal_mulai", { ascending: true })

    const { data: pengelolaData } = await supabase
      .from("users")
      .select("id")
      .eq("role", "pengelola")

    const { data: logData } = await supabase
      .from("aktivitas_log")
      .select(`
        id,
        lahan_id,
        pengelola_id,
        tanggal,
        jenis_aktivitas,
        deskripsi,
        bukti,
        created_at,
        lahan (
          lokasi,
          luas,
          status
        )
      `)
      .order("tanggal", { ascending: false })
      .order("created_at", { ascending: false })

    setLahanList((lahanData || []) as LahanItem[])
    setJadwalList((jadwalData || []) as unknown as JadwalTanam[])
    setLogList((logData || []) as unknown as AktivitasLog[])
    setPengelolaCount((pengelolaData || []).length)
    setLoading(false)
  }

  const agendaItems = useMemo(() => buildAgendaFromJadwal(jadwalList, today, logList), [jadwalList, today, logList])
  const todayString = toDateInputValue(today)
  const todayAgendaItems = agendaItems.filter((item) => item.status === "today")
  const urgentAgenda = agendaItems.filter((item) => item.status !== "upcoming")
  const upcomingAgendaItems = useMemo(() => buildUpcomingFromJadwal(jadwalList, today, logList, 7), [jadwalList, today, logList])

  const visibleAgendaLimit = 3
  const visibleScheduleLimit = 3
  const displayedTodayAgendaItems = todayAgendaItems.slice(0, visibleAgendaLimit)
  const displayedNearestSchedules = upcomingAgendaItems.slice(0, visibleScheduleLimit)
  const showAllAgendaButton = todayAgendaItems.length > visibleAgendaLimit
  const showAllScheduleButton = upcomingAgendaItems.length > visibleScheduleLimit

  const nearestSchedules = displayedNearestSchedules

  const lahanAktif = lahanList.filter((x) => ["masa_tanam_aktif", "menjelang_panen", "siap_tanam_kembali"].includes(x.status)).length
  const lahanSiapPanen = lahanList.filter((x) => x.status === "menjelang_panen").length
  const lahanIstirahat = lahanList.filter((x) => ["istirahat", "panen_selesai"].includes(x.status)).length
  const perluPerhatian = todayAgendaItems.length

  const priorityLahan = useMemo(() => {
    const urgentLahanIds = new Set(
      agendaItems
        .filter((item) => item.status === "overdue")
        .map((item) => item.lahan)
    )

    return lahanList
      .map((lahan) => {
        const relatedAgenda = agendaItems.find((item) => item.lahan === lahan.lokasi)
        const isLate = urgentLahanIds.has(lahan.lokasi)

        return {
          ...lahan,
          label: isLate ? "Terlewat" : relatedAgenda ? "Perhatian" : statusLabel(lahan.status),
          description: isLate
            ? "Aktivitas melewati jadwal"
            : relatedAgenda
            ? `${relatedAgenda.title} perlu dipantau`
            : statusLabel(lahan.status),
          priority: isLate ? 0 : relatedAgenda ? 1 : 2,
        }
      })
      .sort((a, b) => a.priority - b.priority)
      .slice(0, 3)
  }, [agendaItems, lahanList])

  const currentMonth = today.getMonth()
  const currentYear = today.getFullYear()
  const firstDay = new Date(currentYear, currentMonth, 1)
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate()
  const startOffset = (firstDay.getDay() + 6) % 7
  const calendarCells = Array.from({ length: startOffset + daysInMonth }, (_, index) => {
    const dateNumber = index - startOffset + 1
    if (dateNumber < 1) return null
    return new Date(currentYear, currentMonth, dateNumber)
  })

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7faf5] text-gray-700">
        Memuat dashboard...
      </main>
    )
  }

  if (!user) return null

  if (user.role === "pemilik") {
    return (
      <main className="min-h-screen bg-[#f7faf5] text-gray-950">
        <RiceShareTopNav user={user} notificationCount={perluPerhatian} />

        <div className="pb-28 lg:pb-10">
          <div className="mx-auto max-w-7xl px-4 py-5 md:px-6">
            {/* HERO */}
            <section className="mb-5">
              <div className="flex items-center gap-4 rounded-[28px] bg-white/70 p-4 shadow-sm ring-1 ring-black/5 md:bg-transparent md:p-0 md:shadow-none md:ring-0">
                <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-green-700 via-green-500 to-lime-400 text-4xl text-white shadow-xl md:h-24 md:w-24">
                  👑
                </div>
                <div>
                  <p className="text-sm font-black uppercase tracking-[0.2em] text-green-700">Dashboard Pemilik</p>
                  <h1 className="mt-1 text-3xl font-black tracking-tight md:text-4xl">
                    {getGreeting()}, {user.nama.split(" ")[0]} ☀️
                  </h1>
                  <p className="mt-2 text-sm font-medium text-gray-500 md:text-lg">
                    Pantau lahan, pengelola, jadwal, dan laporan dari satu tempat.
                  </p>
                </div>
              </div>
            </section>

            {/* TOP CARDS */}
            <section className="mb-5 grid gap-4 xl:grid-cols-12">
              {/* AGENDA */}
              <div className="rounded-[28px] border border-gray-100 bg-white p-4 shadow-[0_10px_35px_rgba(15,23,42,0.07)] xl:col-span-5">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-green-50 text-green-700 ring-1 ring-green-100">
                      <CalendarDays size={18} />
                    </span>
                    <h2 className="text-lg font-black">Agenda Hari Ini</h2>
                    <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-red-500 px-2 text-sm font-black text-white">
                      {perluPerhatian}
                    </span>
                  </div>
                </div>

                <div className="space-y-3">
                  {displayedTodayAgendaItems.map((item) => {
                    const Icon = item.icon
                    const colorClass =
                      item.status === "overdue"
                        ? "bg-red-500 text-white"
                        : item.title.toLowerCase().includes("hama")
                        ? "bg-amber-400 text-white"
                        : "bg-green-500 text-white"

                    return (
                      <div key={item.id} className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-3 shadow-sm">
                        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${colorClass}`}>
                          <Icon size={24} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="truncate font-black">{item.title}</h3>
                          <p className="text-xs font-medium text-gray-500">
                            {item.lahan} <span className="mx-1">•</span> {item.dateText}
                          </p>
                        </div>
                        <button
                          onClick={() => router.push(`/kalender?tanggal=${todayString}`)}
                          className="rounded-xl border border-green-600 px-4 py-2 text-xs font-black text-green-700 transition hover:scale-105"
                        >
                          Lihat Detail
                        </button>
                      </div>
                    )
                  })}

                  {todayAgendaItems.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-green-200 bg-green-50 p-5 text-center text-sm font-semibold text-green-700">
                      Tidak ada keperluan untuk hari ini.
                    </div>
                  )}
                </div>

                {showAllAgendaButton && (
                  <button onClick={() => router.push(`/kalender?tanggal=${todayString}`)} className="mt-4 flex w-full items-center justify-center gap-2 text-sm font-black text-green-700">
                    Lihat semua agenda <ChevronRight size={16} />
                  </button>
                )}
              </div>

              {/* CALENDAR */}
              <div className="rounded-[28px] border border-gray-100 bg-white p-4 shadow-[0_10px_35px_rgba(15,23,42,0.07)] xl:col-span-3">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-black">Kalender</h2>
                  <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-black text-green-700">{monthNames[currentMonth]} {currentYear}</span>
                </div>

                <div className="grid grid-cols-7 gap-2 text-center text-xs font-bold text-gray-500">
                  {dayLabels.map((day) => <div key={day}>{day}</div>)}
                </div>
                <div className="mt-3 grid grid-cols-7 gap-2 text-center text-sm font-semibold">
                  {calendarCells.map((date, index) => {
                    const calendarPreviewItems = [...agendaItems, ...upcomingAgendaItems]
                    const hasAgenda = date ? calendarPreviewItems.some((item) => sameDay(item.date, date)) : false
                    const hasOverdue = date ? calendarPreviewItems.some((item) => sameDay(item.date, date) && item.status === "overdue") : false
                    const isToday = date ? sameDay(date, today) : false

                    return (
                      <div key={index} className="flex h-8 items-center justify-center">
                        {date && (
                          <span className={`relative flex h-8 w-8 items-center justify-center rounded-full ${isToday ? "bg-green-700 text-white" : "text-gray-800"}`}>
                            {date.getDate()}
                            {hasAgenda && !isToday && (
                              <span className={`absolute -bottom-0.5 h-1.5 w-1.5 rounded-full ${hasOverdue ? "bg-red-500" : "bg-green-600"}`} />
                            )}
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>

                <div className="mt-5 flex flex-wrap items-center gap-4 text-xs font-medium text-gray-500">
                  <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-green-500" />Kegiatan</span>
                  <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-amber-400" />Perhatian</span>
                  <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-red-500" />Terlewat</span>
                </div>

                <button onClick={() => router.push("/kalender")} className="mt-4 flex w-full items-center justify-center gap-2 text-sm font-black text-green-700">
                  Lihat detail kalender <ChevronRight size={16} />
                </button>
              </div>

              {/* NEAREST */}
              <div className="rounded-[28px] border border-gray-100 bg-white p-4 shadow-[0_10px_35px_rgba(15,23,42,0.07)] xl:col-span-4">
                <h2 className="mb-4 text-lg font-black">Jadwal Terdekat</h2>
                <div className="space-y-3">
                  {nearestSchedules.map((item) => (
                    <div key={item.id} className="flex items-center gap-3 rounded-2xl border border-gray-100 p-4">
                      <span className={`h-3 w-3 rounded-full ${item.status === "overdue" ? "bg-red-500" : item.title.toLowerCase().includes("hama") ? "bg-amber-400" : "bg-green-600"}`} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-black">{item.title}</p>
                        <p className="text-sm text-gray-500">{item.lahan}</p>
                      </div>
                      <div className="text-right text-sm font-semibold text-gray-500">
                        <p>{formatShortDate(item.date)}</p>
                        <p>08.00</p>
                      </div>
                    </div>
                  ))}


                </div>

                {showAllScheduleButton && (
                  <button onClick={() => router.push("/kalender?range=upcoming")} className="mt-4 flex w-full items-center justify-between text-sm font-black text-green-700">
                    Lihat semua jadwal <ChevronRight size={18} />
                  </button>
                )}
              </div>
            </section>

            {/* MAIN CONTENT LAYOUT */}
            <section className="grid gap-4 xl:grid-cols-12">
              {/* LEFT AREA */}
              <div className="space-y-4 xl:col-span-8">
                {/* SUMMARY */}
                <section className="rounded-[28px] border border-gray-100 bg-white p-4 shadow-[0_10px_35px_rgba(15,23,42,0.07)]">
                  <h2 className="mb-4 text-lg font-black">Ringkasan Pemilik</h2>
                  <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    <SummaryCard icon={Sprout} value={lahanList.length} title="Total Lahan" desc="" tone="green" />
                    <SummaryCard icon={UsersRound} value={pengelolaCount} title="Pengelola" desc="" tone="blue" />
                    <SummaryCard icon={CalendarDays} value={perluPerhatian} title="Agenda Hari Ini" desc="" tone="yellow" />
                    <SummaryCard icon={FileText} value={logList.length} title="Aktivitas Terbaru" desc="" tone="red" />
                  </div>
                </section>

                {/* BOTTOM LEFT */}
                <section className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-[28px] border border-gray-100 bg-white p-4 shadow-[0_10px_35px_rgba(15,23,42,0.07)]">
                    <h2 className="mb-4 text-lg font-black">Aksi Cepat Pemilik</h2>
                    <div className="grid grid-cols-4 gap-3">
                      <QuickAction icon={UserCog} label="Kelola Pengelola" onClick={() => router.push("/pengelola")} />
                      <QuickAction icon={Eye} label="Lihat Lahan" onClick={() => router.push("/lahan")} />
                      <QuickAction icon={CalendarDays} label="Kalender" onClick={() => router.push("/kalender")} />
                      <QuickAction icon={FileText} label="Laporan" onClick={() => router.push("/laporan")} />
                    </div>
                  </div>

                  <div className="rounded-[28px] border border-gray-100 bg-white p-4 shadow-[0_10px_35px_rgba(15,23,42,0.07)]">
                    <div className="mb-4 flex items-center justify-between">
                      <h2 className="text-lg font-black">Aktivitas Terbaru</h2>
                      <button onClick={() => router.push("/log")} className="text-xs font-black text-green-700">Lihat semua</button>
                    </div>
                    <div className="space-y-3">
                      {logList.slice(0, 4).map((log) => {
                        const Icon = getActivityIcon(log.jenis_aktivitas)
                        return (
                          <div key={log.id} className="flex items-center gap-3">
                            <Icon size={20} className="text-green-700" />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-black">{log.jenis_aktivitas}</p>
                              <p className="truncate text-xs text-gray-500">{log.lahan?.lokasi || "Lahan"}</p>
                            </div>
                            <div className="text-right text-xs font-semibold text-gray-500">
                              <p>{formatTime(log.created_at || log.tanggal)}</p>
                              {log.bukti && <ImageIcon size={14} className="ml-auto mt-1" />}
                            </div>
                          </div>
                        )
                      })}

                      {logList.length === 0 && (
                        <div className="rounded-2xl border border-dashed border-green-200 bg-green-50 p-5 text-center text-sm font-semibold text-green-700">
                          Belum ada aktivitas terbaru.
                        </div>
                      )}
                    </div>
                  </div>
                </section>
              </div>

              {/* RIGHT AREA */}
              <aside className="rounded-[28px] border border-gray-100 bg-white p-4 shadow-[0_10px_35px_rgba(15,23,42,0.07)] xl:col-span-4">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-black">Lahan Prioritas</h2>
                  <button onClick={() => router.push("/lahan")} className="text-xs font-black text-green-700">Lihat semua</button>
                </div>
                <div className="space-y-3">
                  {priorityLahan.map((lahan, index) => (
                    <button
                      key={lahan.id}
                      onClick={() => router.push(`/lahan/${lahan.id}`)}
                      className="flex w-full items-center gap-3 rounded-2xl border border-gray-100 p-3 text-left transition hover:bg-green-50"
                    >
                      <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-green-300 to-lime-600 text-2xl text-white">
                        {index === 0 ? "🌾" : index === 1 ? "🌱" : "🌿"}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate font-black">{lahan.lokasi}</h3>
                        <p className="truncate text-sm text-gray-500">{lahan.description}</p>
                      </div>
                      <span className={`rounded-xl px-3 py-1 text-xs font-black ${lahan.label === "Terlewat" ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-600"}`}>
                        {lahan.label}
                      </span>
                    </button>
                  ))}

                  {priorityLahan.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-green-200 bg-green-50 p-5 text-center text-sm font-semibold text-green-700">
                      Belum ada lahan prioritas.
                    </div>
                  )}
                </div>
              </aside>
            </section>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#f7faf5] text-gray-950">
      <RiceShareTopNav user={user} notificationCount={perluPerhatian} />

      <div className="pb-28 lg:pb-10">
        <div className="mx-auto max-w-7xl px-4 py-5 md:px-6">
          {/* HERO */}
          <section className="mb-5">
            <div className="flex items-center gap-4 rounded-[28px] bg-white/70 p-4 shadow-sm ring-1 ring-black/5 md:bg-transparent md:p-0 md:shadow-none md:ring-0">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-green-700 via-green-500 to-lime-400 text-4xl text-white shadow-xl md:h-24 md:w-24">
                🌾
              </div>
              <div>
                <h1 className="text-3xl font-black tracking-tight md:text-4xl">
                  {getGreeting()}, {user.nama.split(" ")[0]} ☀️
                </h1>
                <p className="mt-2 text-sm font-medium text-gray-500 md:text-lg">
                  Ada {perluPerhatian} jadwal yang perlu ditindaklanjuti hari ini.
                </p>
              </div>
            </div>
          </section>

          {/* TOP CARDS */}
          <section className="mb-5 grid gap-4 xl:grid-cols-12">
            {/* AGENDA */}
            <div className="rounded-[28px] border border-gray-100 bg-white p-4 shadow-[0_10px_35px_rgba(15,23,42,0.07)] xl:col-span-5">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-green-50 text-green-700 ring-1 ring-green-100">
                    <CalendarDays size={18} />
                  </span>
                  <h2 className="text-lg font-black">Agenda Hari Ini</h2>
                  <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-red-500 px-2 text-sm font-black text-white">
                    {perluPerhatian}
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                {displayedTodayAgendaItems.map((item, index) => {
                  const Icon = item.icon
                  const colorClass =
                    item.status === "overdue"
                      ? "bg-red-500 text-white"
                      : item.title.toLowerCase().includes("hama")
                      ? "bg-amber-400 text-white"
                      : "bg-green-500 text-white"

                  return (
                    <div key={item.id} className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-3 shadow-sm">
                      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${colorClass}`}>
                        <Icon size={24} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate font-black">{item.title}</h3>
                        <p className="text-xs font-medium text-gray-500">
                          {item.lahan} <span className="mx-1">•</span> {item.dateText}
                        </p>
                      </div>
                      <button
                        onClick={() => router.push(item.actionPath)}
                        className={`rounded-xl px-4 py-2 text-xs font-black transition hover:scale-105 ${
                          index === 0
                            ? "bg-green-700 text-white"
                            : item.status === "overdue"
                            ? "border border-green-600 text-green-700"
                            : "border border-green-600 text-green-700"
                        }`}
                      >
                        {item.actionLabel}
                      </button>
                    </div>
                  )
                })}

                {todayAgendaItems.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-green-200 bg-green-50 p-5 text-center text-sm font-semibold text-green-700">
                    Tidak ada keperluan untuk hari ini.
                  </div>
                )}
              </div>

              <button onClick={() => router.push("/kalender")} className="mt-4 flex w-full items-center justify-center gap-2 text-sm font-black text-green-700">
                Lihat semua agenda <ChevronRight size={16} />
              </button>
            </div>

            {/* CALENDAR */}
            <div className="rounded-[28px] border border-gray-100 bg-white p-4 shadow-[0_10px_35px_rgba(15,23,42,0.07)] xl:col-span-3">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-black">Kalender</h2>
                <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-black text-green-700">{monthNames[currentMonth]} {currentYear}</span>
              </div>

              <div className="grid grid-cols-7 gap-2 text-center text-xs font-bold text-gray-500">
                {dayLabels.map((day) => <div key={day}>{day}</div>)}
              </div>
              <div className="mt-3 grid grid-cols-7 gap-2 text-center text-sm font-semibold">
                {calendarCells.map((date, index) => {
                  const hasAgenda = date ? agendaItems.some((item) => sameDay(item.date, date)) : false
                  const hasOverdue = date ? agendaItems.some((item) => sameDay(item.date, date) && item.status === "overdue") : false
                  const isToday = date ? sameDay(date, today) : false

                  return (
                    <div key={index} className="flex h-8 items-center justify-center">
                      {date && (
                        <span className={`relative flex h-8 w-8 items-center justify-center rounded-full ${isToday ? "bg-green-700 text-white" : "text-gray-800"}`}>
                          {date.getDate()}
                          {hasAgenda && !isToday && (
                            <span className={`absolute -bottom-0.5 h-1.5 w-1.5 rounded-full ${hasOverdue ? "bg-red-500" : "bg-green-600"}`} />
                          )}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-4 text-xs font-medium text-gray-500">
                <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-green-500" />Kegiatan</span>
                <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-amber-400" />Perhatian</span>
                <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-red-500" />Terlewat</span>
              </div>

              <button onClick={() => router.push("/kalender")} className="mt-4 flex w-full items-center justify-center gap-2 text-sm font-black text-green-700">
                Lihat detail kalender <ChevronRight size={16} />
              </button>
            </div>

            {/* NEAREST */}
            <div className="rounded-[28px] border border-gray-100 bg-white p-4 shadow-[0_10px_35px_rgba(15,23,42,0.07)] xl:col-span-4">
              <h2 className="mb-4 text-lg font-black">Jadwal Terdekat</h2>
              <div className="divide-y divide-gray-100 rounded-2xl border border-gray-100">
                {(nearestSchedules.length ? nearestSchedules : agendaItems.slice(0, 3)).map((item) => (
                  <div key={item.id} className="flex items-center gap-3 p-4">
                    <span className={`h-3 w-3 rounded-full ${item.status === "overdue" ? "bg-red-500" : item.title.toLowerCase().includes("hama") ? "bg-amber-400" : "bg-green-600"}`} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-black">{item.title}</p>
                      <p className="text-sm text-gray-500">{item.lahan}</p>
                    </div>
                    <div className="text-right text-sm font-semibold text-gray-500">
                      <p>{formatShortDate(item.date)}</p>
                      <p>08.00</p>
                    </div>
                  </div>
                ))}

                {agendaItems.length === 0 && (
                  <div className="p-6 text-center text-sm font-semibold text-gray-500">
                    
                  </div>
                )}
              </div>

              <button onClick={() => router.push("/kalender")} className="mt-4 flex w-full items-center justify-between text-sm font-black text-green-700">
                Lihat semua jadwal <ChevronRight size={18} />
              </button>
            </div>
          </section>

          {/* MAIN CONTENT LAYOUT */}
          <section className="grid gap-4 xl:grid-cols-12">
            {/* LEFT AREA */}
            <div className="space-y-4 xl:col-span-8">
              {/* SUMMARY */}
              <section className="rounded-[28px] border border-gray-100 bg-white p-4 shadow-[0_10px_35px_rgba(15,23,42,0.07)]">
                <h2 className="mb-4 text-lg font-black">Ringkasan Lahan</h2>
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                  <SummaryCard icon={Sprout} value={lahanAktif} title="Lahan Aktif" desc="" tone="green" />
                  <SummaryCard icon={Wheat} value={lahanSiapPanen} title="Siap Panen" desc="" tone="yellow" />
                  <SummaryCard icon={Droplets} value={lahanIstirahat} title="Masa Istirahat" desc="" tone="blue" />
                  <SummaryCard icon={AlertCircle} value={perluPerhatian} title="Perlu Perhatian" desc="" tone="red" />
                </div>
              </section>

              {/* BOTTOM LEFT */}
              <section className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-[28px] border border-gray-100 bg-white p-4 shadow-[0_10px_35px_rgba(15,23,42,0.07)]">
                  <h2 className="mb-4 text-lg font-black">Aksi Cepat</h2>
                  <div className="grid grid-cols-4 gap-3">
                    <QuickAction icon={Sprout} label="Mulai Tanam" onClick={() => router.push("/tanam")} />
                    <QuickAction icon={ClipboardList} label="Input Log Aktivitas" onClick={() => router.push("/log/tambah")} />
                    <QuickAction icon={Wheat} label="Input Panen" onClick={() => router.push("/panen")} />
                    <QuickAction icon={Eye} label="Lihat Lahan" onClick={() => router.push("/lahan")} />
                  </div>
                </div>

                <div className="rounded-[28px] border border-gray-100 bg-white p-4 shadow-[0_10px_35px_rgba(15,23,42,0.07)]">
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-lg font-black">Aktivitas Terbaru</h2>
                    <button onClick={() => router.push("/log")} className="text-xs font-black text-green-700">Lihat semua</button>
                  </div>
                  <div className="space-y-3">
                    {logList.slice(0, 4).map((log) => {
                      const Icon = getActivityIcon(log.jenis_aktivitas)
                      return (
                        <div key={log.id} className="flex items-center gap-3">
                          <Icon size={20} className="text-green-700" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-black">{log.jenis_aktivitas}</p>
                            <p className="truncate text-xs text-gray-500">{log.lahan?.lokasi || "Lahan"} • oleh {user.nama.split(" ")[0]}</p>
                          </div>
                          <div className="text-right text-xs font-semibold text-gray-500">
                            <p>{formatTime(log.created_at || log.tanggal)}</p>
                            {log.bukti && <ImageIcon size={14} className="ml-auto mt-1" />}
                          </div>
                        </div>
                      )
                    })}

                    {logList.length === 0 && (
                      <div className="rounded-2xl border border-dashed border-green-200 bg-green-50 p-5 text-center text-sm font-semibold text-green-700">
                        Belum ada aktivitas terbaru.
                      </div>
                    )}
                  </div>
                </div>
              </section>
            </div>

            {/* RIGHT AREA */}
            <aside className="rounded-[28px] border border-gray-100 bg-white p-4 shadow-[0_10px_35px_rgba(15,23,42,0.07)] xl:col-span-4">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-black">Lahan Prioritas</h2>
                <button onClick={() => router.push("/lahan")} className="text-xs font-black text-green-700">Lihat semua</button>
              </div>
              <div className="space-y-3">
                {priorityLahan.map((lahan, index) => (
                  <button
                    key={lahan.id}
                    onClick={() => router.push(`/lahan/${lahan.id}`)}
                    className="flex w-full items-center gap-3 rounded-2xl border border-gray-100 p-3 text-left transition hover:bg-green-50"
                  >
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-green-300 to-lime-600 text-2xl text-white">
                      {index === 0 ? "🌾" : index === 1 ? "🌱" : "🌿"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate font-black">{lahan.lokasi}</h3>
                      <p className="truncate text-sm text-gray-500">{lahan.description}</p>
                    </div>
                    <span className={`rounded-xl px-3 py-1 text-xs font-black ${lahan.label === "Terlewat" ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-600"}`}>
                      {lahan.label}
                    </span>
                  </button>
                ))}

                {priorityLahan.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-green-200 bg-green-50 p-5 text-center text-sm font-semibold text-green-700">
                    Belum ada lahan prioritas.
                  </div>
                )}
              </div>
            </aside>
          </section>
        </div>
      </div>
    </main>
  )
}

function OwnerStatusRow({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone: "green" | "yellow" | "blue" | "red"
}) {
  const tones = {
    green: "bg-green-500",
    yellow: "bg-amber-400",
    blue: "bg-blue-500",
    red: "bg-red-500",
  }

  return (
    <div className="flex items-center justify-between rounded-2xl border border-gray-100 bg-white p-3 shadow-sm">
      <div className="flex items-center gap-3">
        <span className={`h-3 w-3 rounded-full ${tones[tone]}`} />
        <span className="text-sm font-black text-gray-700">{label}</span>
      </div>
      <span className="text-lg font-black">{value}</span>
    </div>
  )
}

function SummaryCard({
  icon: Icon,
  value,
  title,
  desc,
  tone,
}: {
  icon: typeof Sprout
  value: number
  title: string
  desc: string
  tone: "green" | "yellow" | "blue" | "red"
}) {
  const tones = {
    green: "border-green-100 bg-green-50 text-green-700",
    yellow: "border-amber-100 bg-amber-50 text-amber-600",
    blue: "border-blue-100 bg-blue-50 text-blue-600",
    red: "border-red-100 bg-red-50 text-red-600",
  }

  return (
    <div className="flex items-center gap-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full border ${tones[tone]}`}>
        <Icon size={28} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="text-2xl font-black">{value}</p>
        </div>
        <p className="text-sm font-black">{title}</p>
        {desc && <p className="truncate text-xs text-gray-500">{desc}</p>}
      </div>
    </div>
  )
}

function QuickAction({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Sprout
  label: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="flex aspect-square min-h-[96px] flex-col items-center justify-center gap-2 rounded-2xl border border-gray-100 bg-white p-3 text-center shadow-sm transition hover:-translate-y-1 hover:bg-green-50"
    >
      <Icon size={32} className="text-green-700" />
      <span className="text-xs font-black leading-tight text-green-700 md:text-sm">{label}</span>
    </button>
  )
}
