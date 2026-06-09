"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  AlertCircle,
  BellRing,
  CheckCircle2,
  ChevronRight,
  Clock3,
  ClipboardList,
  Info,
  Leaf,
  MapPin,
  RefreshCcw,
  Sprout,
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

type NotificationPriority = "urgent" | "today" | "soon" | "info"

type NotificationItem = {
  id: string
  lahan_id: string
  lokasi: string
  title: string
  message: string
  priority: NotificationPriority
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

type AktivitasLog = {
  id: string
  lahan_id: string
  jenis_aktivitas: string
  tanggal?: string | null
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

function toDateInputValue(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")

  return `${year}-${month}-${day}`
}

function parseLocalDate(dateStr: string) {
  return new Date(`${dateStr}T00:00:00`)
}

function getToday(): string {
  return toDateInputValue(new Date())
}

function addDays(dateStr: string, days: number): string {
  const d = parseLocalDate(dateStr)
  d.setDate(d.getDate() + days)
  return toDateInputValue(d)
}

function diffDays(a: string, b: string): number {
  return Math.floor(
    (parseLocalDate(b).getTime() - parseLocalDate(a).getTime()) / (1000 * 60 * 60 * 24)
  )
}

function formatDateId(dateString?: string | null) {
  if (!dateString) return "-"

  return new Date(dateString).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
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

function getPriorityLabel(priority: NotificationPriority) {
  switch (priority) {
    case "urgent":
      return "Mendesak"
    case "today":
      return "Hari Ini"
    case "soon":
      return "Segera"
    default:
      return "Info"
  }
}

function getPriorityIcon(priority: NotificationPriority) {
  switch (priority) {
    case "urgent":
      return AlertCircle
    case "today":
      return Clock3
    case "soon":
      return BellRing
    default:
      return Info
  }
}

function getPriorityStyle(priority: NotificationPriority) {
  switch (priority) {
    case "urgent":
      return {
        card: "border-red-100 bg-red-50/70",
        icon: "bg-red-100 text-red-600",
        badge: "bg-red-100 text-red-700",
      }
    case "today":
      return {
        card: "border-green-100 bg-green-50/70",
        icon: "bg-green-100 text-green-700",
        badge: "bg-green-100 text-green-700",
      }
    case "soon":
      return {
        card: "border-amber-100 bg-amber-50/70",
        icon: "bg-amber-100 text-amber-600",
        badge: "bg-amber-100 text-amber-700",
      }
    default:
      return {
        card: "border-blue-100 bg-blue-50/70",
        icon: "bg-blue-100 text-blue-600",
        badge: "bg-blue-100 text-blue-700",
      }
  }
}

export default function NotifikasiPage() {
  const router = useRouter()

  const [user, setUser] = useState<UserProfile | null>(null)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const savedUser = localStorage.getItem("riceshare_user")
    if (!savedUser) {
      router.push("/")
      return
    }

    const parsedUser = JSON.parse(savedUser) as UserProfile
    setUser(parsedUser)
    fetchNotifications()
  }, [])

  async function fetchNotifications() {
    setLoading(true)

    await syncLahanStatus()

    const today = getToday()
    const notifs: NotificationItem[] = []

    const { data: lahanData } = await supabase
      .from("lahan")
      .select(`
        id, lokasi, status,
        jadwal_tanam (
          id, tanggal_mulai, tanggal_selesai, status,
          timeline_overrides, created_at
        )
      `)

    const { data: aktivitasData } = await supabase
      .from("aktivitas_log")
      .select("id, lahan_id, jenis_aktivitas, tanggal")

    const logsByLahan = ((aktivitasData || []) as AktivitasLog[]).reduce(
      (acc, log) => {
        if (!acc[log.lahan_id]) acc[log.lahan_id] = []
        acc[log.lahan_id].push(log)
        return acc
      },
      {} as Record<string, AktivitasLog[]>
    )

    if (lahanData) {
      for (const lahan of lahanData) {
        const jadwalList = (lahan.jadwal_tanam as any[]) || []
        const jadwal = [...jadwalList].sort((a, b) => {
          const bTime = b.created_at ? new Date(b.created_at).getTime() : 0
          const aTime = a.created_at ? new Date(a.created_at).getTime() : 0
          return bTime - aTime
        })[0]

        if (!jadwal?.tanggal_mulai) {
          notifs.push({
            id: `no-jadwal-${lahan.id}`,
            lahan_id: lahan.id,
            lokasi: lahan.lokasi || "Lahan",
            title: `${lahan.lokasi || "Lahan"} belum punya jadwal tanam`,
            message: "Tambahkan jadwal musim tanam agar aktivitas lahan bisa dipantau.",
            priority: "info",
          })
          continue
        }

        const overrides = (jadwal.timeline_overrides as Record<string, string>) || {}
        const tglPanenEst = overrides["panen_estimasi"] || addDays(jadwal.tanggal_mulai, 105)
        const tglMenjelang = overrides["menjelang_panen"] || addDays(jadwal.tanggal_mulai, 70)

        const hariMenujuPanen = diffDays(today, tglPanenEst)
        const hariMenujuMenjelang = diffDays(today, tglMenjelang)
        const status = lahan.status
        const lokasi = lahan.lokasi || "Lahan"
        const timeline = buildTimeline(jadwal.tanggal_mulai, overrides)
        const aktivitasLogs = logsByLahan[lahan.id] || []

        timeline
          .filter((item) => item.startDate <= today)
          .filter((item) => !timelineItemSudahDicatat(item, aktivitasLogs))
          .forEach((item) => {
            const isOverdue = item.endDate < today
            const isToday = item.startDate <= today && item.endDate >= today

            if (!isOverdue && !isToday) return

            notifs.push({
              id: `aktivitas-belum-dicatat-${lahan.id}-${item.key}`,
              lahan_id: lahan.id,
              lokasi,
              title: `${item.label} ${lokasi} belum dicatat`,
              message: `Jadwal ${item.label}: ${item.tanggalText}. Catat log aktivitas jika pekerjaan sudah dilakukan.`,
              priority: isOverdue ? "urgent" : "today",
            })
          })

        if (status === "menjelang_panen") {
          if (hariMenujuPanen <= 0) {
            notifs.push({
              id: `panen-terlambat-${lahan.id}`,
              lahan_id: lahan.id,
              lokasi,
              title: `Panen ${lokasi} sudah melewati estimasi`,
              message: `Estimasi panen ${formatDateId(tglPanenEst)} sudah lewat. Segera input hasil panen.`,
              priority: "urgent",
            })
          } else if (hariMenujuPanen <= 3) {
            notifs.push({
              id: `panen-segera-${lahan.id}`,
              lahan_id: lahan.id,
              lokasi,
              title: `Panen ${lokasi} ${hariMenujuPanen} hari lagi`,
              message: `Lahan ini menjelang panen. Estimasi panen: ${formatDateId(tglPanenEst)}.`,
              priority: hariMenujuPanen === 0 ? "today" : "soon",
            })
          } else {
            notifs.push({
              id: `menjelang-panen-${lahan.id}`,
              lahan_id: lahan.id,
              lokasi,
              title: `${lokasi} menjelang panen`,
              message: `Estimasi panen pada ${formatDateId(tglPanenEst)}. Persiapkan proses panen.`,
              priority: "soon",
            })
          }
        }

        if (status === "masa_tanam_aktif" && hariMenujuMenjelang <= 7 && hariMenujuMenjelang > 0) {
          notifs.push({
            id: `mendekati-menjelang-${lahan.id}`,
            lahan_id: lahan.id,
            lokasi,
            title: `${lokasi} akan memasuki masa menjelang panen`,
            message: `${hariMenujuMenjelang} hari lagi lahan ini masuk fase menjelang panen.`,
            priority: "soon",
          })
        }

        if (status === "panen_selesai") {
          notifs.push({
            id: `input-panen-${lahan.id}`,
            lahan_id: lahan.id,
            lokasi,
            title: `Input hasil panen ${lokasi}`,
            message: "Panen selesai. Segera masukkan data hasil panen untuk menghitung bagi hasil.",
            priority: "urgent",
          })
        }

        if (status === "siap_tanam_kembali") {
          notifs.push({
            id: `siap-tanam-${lahan.id}`,
            lahan_id: lahan.id,
            lokasi,
            title: `${lokasi} siap tanam kembali`,
            message: "Masa istirahat selesai. Lahan siap untuk musim tanam berikutnya.",
            priority: "info",
          })
        }
      }
    }

    // Notifikasi log menunggu verifikasi dinonaktifkan agar tidak bentrok
    // dengan status aktivitas yang sudah dicatat.

    const order: Record<NotificationPriority, number> = {
      urgent: 0,
      today: 1,
      soon: 2,
      info: 3,
    }

    notifs.sort((a, b) => order[a.priority] - order[b.priority])

    setNotifications(notifs)
    setLoading(false)
  }

  const summary = useMemo(() => {
    return {
      urgent: notifications.filter((item) => item.priority === "urgent").length,
      today: notifications.filter((item) => item.priority === "today").length,
      soon: notifications.filter((item) => item.priority === "soon").length,
      info: notifications.filter((item) => item.priority === "info").length,
    }
  }, [notifications])

  if (!user) return null

  const isPengelola = user.role === "pengelola"

  return (
    <main className="min-h-screen bg-[#f7faf5] text-gray-950">
      <RiceShareTopNav user={user} />

      <div className="pb-28 lg:pb-10">
        <div className="mx-auto w-full max-w-7xl px-4 py-5 md:px-6 md:py-7">
          <section className="mb-5 flex flex-col gap-5 rounded-[32px] border border-green-100 bg-white/80 p-5 shadow-[0_18px_45px_rgba(15,23,42,0.06)] md:flex-row md:items-center md:justify-between md:p-7">
            <div className="flex items-center gap-4">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-green-600 to-lime-400 text-white shadow-xl md:h-24 md:w-24">
                <BellRing size={42} />
              </div>

              <div>
                <p className="text-sm font-bold text-green-700">RiceShare</p>
                <h1 className="text-3xl font-black tracking-tight md:text-4xl">
                  Notifikasi
                </h1>
                <p className="mt-1 max-w-2xl text-sm font-medium text-gray-500 md:text-base">
                  Pantau pengingat lahan, jadwal penting, dan log aktivitas yang perlu ditindaklanjuti.
                </p>
              </div>
            </div>

            <button
              onClick={fetchNotifications}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-green-100 bg-white px-5 py-3 text-sm font-extrabold text-green-700 shadow-sm transition hover:bg-green-50 md:w-auto"
            >
              <RefreshCcw size={18} />
              Refresh
            </button>
          </section>

          <section className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded-[26px] border border-red-100 bg-white p-4 shadow-[0_14px_35px_rgba(15,23,42,0.05)]">
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-red-100 text-red-600">
                <AlertCircle size={22} />
              </div>
              <p className="text-3xl font-black">{summary.urgent}</p>
              <p className="text-sm font-bold text-gray-500">Mendesak</p>
            </div>

            <div className="rounded-[26px] border border-green-100 bg-white p-4 shadow-[0_14px_35px_rgba(15,23,42,0.05)]">
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-green-100 text-green-700">
                <Clock3 size={22} />
              </div>
              <p className="text-3xl font-black">{summary.today}</p>
              <p className="text-sm font-bold text-gray-500">Hari Ini</p>
            </div>

            <div className="rounded-[26px] border border-amber-100 bg-white p-4 shadow-[0_14px_35px_rgba(15,23,42,0.05)]">
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                <BellRing size={22} />
              </div>
              <p className="text-3xl font-black">{summary.soon}</p>
              <p className="text-sm font-bold text-gray-500">Segera</p>
            </div>

            <div className="rounded-[26px] border border-blue-100 bg-white p-4 shadow-[0_14px_35px_rgba(15,23,42,0.05)]">
              <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                <Info size={22} />
              </div>
              <p className="text-3xl font-black">{summary.info}</p>
              <p className="text-sm font-bold text-gray-500">Info</p>
            </div>
          </section>

          <section className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_360px]">
            <div className="rounded-[32px] border border-green-100 bg-white p-4 shadow-[0_18px_45px_rgba(15,23,42,0.06)] md:p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black">Daftar Notifikasi</h2>
                  <p className="text-sm font-medium text-gray-500">
                    Diurutkan dari yang paling penting.
                  </p>
                </div>

                <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-extrabold text-green-700">
                  {notifications.length} total
                </span>
              </div>

              {loading ? (
                <div className="rounded-[26px] border border-green-100 bg-green-50/70 p-6 text-sm font-semibold text-gray-500">
                  Memuat notifikasi...
                </div>
              ) : notifications.length === 0 ? (
                <div className="rounded-[28px] border border-green-100 bg-green-50/70 p-8 text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-700">
                    <CheckCircle2 size={34} />
                  </div>
                  <p className="text-lg font-black text-gray-900">Tidak ada notifikasi</p>
                  <p className="mt-1 text-sm font-medium text-gray-500">
                    Semua lahan sedang aman dan tidak ada tugas yang perlu ditindaklanjuti.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {notifications.map((notif) => {
                    const style = getPriorityStyle(notif.priority)
                    const Icon = getPriorityIcon(notif.priority)

                    return (
                      <article
                        key={notif.id}
                        className={`rounded-[28px] border p-4 transition hover:-translate-y-0.5 hover:shadow-lg md:p-5 ${style.card}`}
                      >
                        <div className="flex items-start gap-4">
                          <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${style.icon}`}>
                            <Icon size={24} />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                              <div>
                                <h3 className="text-base font-black text-gray-950 md:text-lg">
                                  {notif.title}
                                </h3>
                                <p className="mt-1 flex items-center gap-1 text-sm font-semibold text-gray-500">
                                  <MapPin size={14} />
                                  {notif.lokasi}
                                </p>
                              </div>

                              <span className={`w-fit rounded-full px-3 py-1 text-xs font-extrabold ${style.badge}`}>
                                {getPriorityLabel(notif.priority)}
                              </span>
                            </div>

                            <p className="mt-3 text-sm font-medium leading-relaxed text-gray-600">
                              {notif.message}
                            </p>

                            <div className="mt-4 flex flex-wrap gap-2">
                              <button
                                onClick={() => router.push(`/lahan/${notif.lahan_id}`)}
                                className="inline-flex items-center gap-2 rounded-2xl border border-green-100 bg-white px-4 py-2 text-sm font-extrabold text-green-700 shadow-sm transition hover:bg-green-50"
                              >
                                Detail Lahan
                                <ChevronRight size={16} />
                              </button>

                              {isPengelola && (
                                <button
                                  onClick={() => router.push(`/log/tambah?lahan_id=${notif.lahan_id}`)}
                                  className="inline-flex items-center gap-2 rounded-2xl bg-green-700 px-4 py-2 text-sm font-extrabold text-white shadow-sm transition hover:bg-green-800"
                                >
                                  <ClipboardList size={16} />
                                  Tambah Log
                                </button>
                              )}

                              {isPengelola && notif.id.startsWith("panen") && (
                                <button
                                  onClick={() => router.push("/panen")}
                                  className="inline-flex items-center gap-2 rounded-2xl bg-amber-500 px-4 py-2 text-sm font-extrabold text-white shadow-sm transition hover:bg-amber-600"
                                >
                                  <Leaf size={16} />
                                  Input Panen
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      </article>
                    )
                  })}
                </div>
              )}
            </div>

            <aside className="space-y-5">
              <div className="rounded-[32px] border border-green-100 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
                <h2 className="text-xl font-black">Prioritas Tindakan</h2>
                <p className="mt-1 text-sm font-medium text-gray-500">
                  Fokuskan pekerjaan dari urutan berikut.
                </p>

                <div className="mt-4 space-y-3">
                  <div className="flex items-center gap-3 rounded-3xl border border-red-100 bg-red-50/70 p-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-red-600">
                      <AlertCircle size={20} />
                    </div>
                    <div>
                      <p className="font-black">Mendesak</p>
                      <p className="text-sm font-medium text-gray-500">Selesaikan terlebih dahulu.</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 rounded-3xl border border-green-100 bg-green-50/70 p-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 text-green-700">
                      <Clock3 size={20} />
                    </div>
                    <div>
                      <p className="font-black">Hari Ini</p>
                      <p className="text-sm font-medium text-gray-500">Perlu ditindaklanjuti hari ini.</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 rounded-3xl border border-amber-100 bg-amber-50/70 p-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                      <Sprout size={20} />
                    </div>
                    <div>
                      <p className="font-black">Segera</p>
                      <p className="text-sm font-medium text-gray-500">Persiapan untuk beberapa hari ke depan.</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-[32px] border border-green-100 bg-gradient-to-br from-green-700 to-emerald-600 p-5 text-white shadow-[0_18px_45px_rgba(15,23,42,0.10)]">
                <p className="text-sm font-bold text-green-100">Tips</p>
                <h2 className="mt-1 text-xl font-black">Cek notifikasi setiap pagi</h2>
                <p className="mt-2 text-sm font-medium leading-relaxed text-green-50">
                  Gunakan halaman ini sebagai daftar pekerjaan utama sebelum mulai aktivitas di lahan.
                </p>
              </div>
            </aside>
          </section>
        </div>
      </div>
    </main>
  )
}
