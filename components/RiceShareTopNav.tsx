"use client"

import { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import {
  LayoutDashboard,
  Map,
  CalendarDays,
  ClipboardList,
  FileText,
  Bell,
  LogOut,
  ChevronDown,
  Sprout,
  UsersRound,
} from "lucide-react"

import { supabase } from "@/lib/supabase"
import { syncLahanStatus } from "@/lib/syncLahanStatus"

type UserProfile = {
  id: string
  nama: string
  email: string
  role: "pemilik" | "pengelola"
}

type RiceShareTopNavProps = {
  user: UserProfile
  notificationCount?: number
}

const mainMenus = [
  {
    icon: LayoutDashboard,
    label: "Dashboard",
    path: "/dashboard",
    match: ["/dashboard"],
  },
  {
    icon: Map,
    label: "Lahan",
    path: "/lahan",
    match: ["/lahan"],
  },
  {
    icon: CalendarDays,
    label: "Kalender",
    path: "/kalender",
    match: ["/kalender"],
  },
  {
    icon: ClipboardList,
    label: "Aktivitas",
    path: "/log",
    match: ["/log", "/tanam"],
  },
  {
    icon: FileText,
    label: "Laporan",
    path: "/laporan",
    match: ["/laporan", "/panen"],
  },
]


const ownerOnlyMenus = [
  {
    icon: UsersRound,
    label: "Pengelola",
    path: "/pengelola",
    match: ["/pengelola"],
  },
]


type NotificationPriority = "urgent" | "today" | "soon" | "info"

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

function getToday() {
  return toDateInputValue(new Date())
}

function addDays(dateStr: string, days: number) {
  const date = parseLocalDate(dateStr)
  date.setDate(date.getDate() + days)
  return toDateInputValue(date)
}

function diffDays(a: string, b: string) {
  return Math.floor(
    (parseLocalDate(b).getTime() - parseLocalDate(a).getTime()) /
      (1000 * 60 * 60 * 24)
  )
}

function buildTimeline(tanggalMulai: string, overrides: TimelineOverrides = {}) {
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
) {
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

async function getNotificationBadgeCount() {
  await syncLahanStatus()

  const today = getToday()
  let count = 0

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

  for (const lahan of lahanData || []) {
    const jadwalList = ((lahan as any).jadwal_tanam as any[]) || []
    const jadwal = [...jadwalList].sort((a, b) => {
      const bTime = b.created_at ? new Date(b.created_at).getTime() : 0
      const aTime = a.created_at ? new Date(a.created_at).getTime() : 0
      return bTime - aTime
    })[0]

    if (!jadwal?.tanggal_mulai) continue

    const overrides = (jadwal.timeline_overrides as TimelineOverrides) || {}
    const timeline = buildTimeline(jadwal.tanggal_mulai, overrides)
    const aktivitasLogs = logsByLahan[(lahan as any).id] || []

    timeline
      .filter((item) => item.startDate <= today)
      .filter((item) => !timelineItemSudahDicatat(item, aktivitasLogs))
      .forEach((item) => {
        const isOverdue = item.endDate < today
        const isToday = item.startDate <= today && item.endDate >= today

        if (isOverdue || isToday) {
          count += 1
        }
      })

    const status = (lahan as any).status
    const tglPanenEst = overrides["panen_estimasi"] || addDays(jadwal.tanggal_mulai, 105)
    const tglMenjelang = overrides["menjelang_panen"] || addDays(jadwal.tanggal_mulai, 70)
    const hariMenujuPanen = diffDays(today, tglPanenEst)
    const hariMenujuMenjelang = diffDays(today, tglMenjelang)

    if (status === "menjelang_panen" && hariMenujuPanen <= 0) {
      count += 1
    }

    if (status === "menjelang_panen" && hariMenujuPanen === 0) {
      count += 1
    }

    if (status === "masa_tanam_aktif" && hariMenujuMenjelang === 0) {
      count += 1
    }

    if (status === "panen_selesai") {
      count += 1
    }
  }

  return count
}


export default function RiceShareTopNav({
  user,
  notificationCount,
}: RiceShareTopNavProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [showProfile, setShowProfile] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [internalNotificationCount, setInternalNotificationCount] = useState(0)

  const displayedNotificationCount =
    notificationCount ?? internalNotificationCount

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 1099px)")

    const updateIsMobile = () => {
      setIsMobile(mediaQuery.matches)
    }

    updateIsMobile()

    document.body.style.paddingBottom = mediaQuery.matches ? "78px" : ""

    const updateBodyPadding = () => {
      document.body.style.paddingBottom = mediaQuery.matches ? "78px" : ""
    }

    mediaQuery.addEventListener("change", updateIsMobile)
    mediaQuery.addEventListener("change", updateBodyPadding)

    return () => {
      mediaQuery.removeEventListener("change", updateIsMobile)
      mediaQuery.removeEventListener("change", updateBodyPadding)
      document.body.style.paddingBottom = ""
    }
  }, [])

  useEffect(() => {
    let isMounted = true

    async function loadNotificationCount() {
      if (notificationCount !== undefined) return

      try {
        const count = await getNotificationBadgeCount()

        if (isMounted) {
          setInternalNotificationCount(count)
        }
      } catch (error) {
        console.log("TOP NAV NOTIFICATION COUNT ERROR:", error)
      }
    }

    loadNotificationCount()

    const interval = window.setInterval(loadNotificationCount, 60000)

    return () => {
      isMounted = false
      window.clearInterval(interval)
    }
  }, [notificationCount])

  const isActive = (matches: string[]) => {
    return matches.some((item) => pathname === item || pathname.startsWith(`${item}/`))
  }

  const handleLogout = () => {
    localStorage.removeItem("riceshare_user")
    router.push("/")
  }

  const menus =
    user.role === "pemilik"
      ? [...mainMenus, ...ownerOnlyMenus]
      : mainMenus

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-green-100 bg-white/90 shadow-sm backdrop-blur-xl">
        <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between gap-3 px-4 md:h-[86px] md:px-6">
          {/* LOGO */}
          <button
            onClick={() => router.push("/dashboard")}
            className="flex items-center gap-3"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-green-600 to-lime-500 text-xl text-white shadow-lg md:h-12 md:w-12 md:text-2xl">
              🌾
            </div>

            <div className="text-left">
              <h1 className="text-lg font-extrabold text-green-700 md:text-2xl">
                RiceShare
              </h1>
              <p className="hidden text-xs font-medium text-gray-500 sm:block">
                {user.role === "pemilik" ? "Pemilik" : "Pengelola"}
              </p>
            </div>
          </button>

          {/* TOP MENU */}
          {!isMobile && (
          <nav className="flex flex-1 items-center justify-center gap-2 overflow-x-auto px-2">
            {menus.map((item) => {
              const Icon = item.icon
              const active = isActive(item.match)

              return (
                <button
                  key={item.path}
                  onClick={() => router.push(item.path)}
                  className={`relative flex min-w-max items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-bold transition-all ${
                    active
                      ? "bg-green-50 text-green-700 shadow-sm"
                      : "text-gray-800 hover:bg-green-50 hover:text-green-700"
                  }`}
                >
                  <Icon size={18} />
                  {item.label}

                  {active && (
                    <span className="absolute bottom-0 left-1/2 h-1 w-16 -translate-x-1/2 rounded-full bg-green-600" />
                  )}
                </button>
              )
            })}
          </nav>
          )}

          {/* RIGHT ACTIONS */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/notifikasi")}
              className="relative flex h-11 w-11 items-center justify-center rounded-full border border-green-100 bg-white text-gray-700 shadow-sm transition hover:bg-green-50 hover:text-green-700"
            >
              {/* Bell icon dengan animasi goyang kalau ada notif */}
              <span className={displayedNotificationCount > 0 ? "animate-[wiggle_1s_ease-in-out_infinite]" : ""}>
                <Bell
                  size={20}
                  className={displayedNotificationCount > 0 ? "text-green-700" : "text-gray-500"}
                />
              </span>

              {/* Badge merah — pakai overflow-visible agar tidak terpotong */}
              {displayedNotificationCount > 0 && (
                <>
                  {/* Pulse ring di belakang */}
                  <span className="absolute -right-1 -top-1 h-4 w-4 animate-ping rounded-full bg-red-400 opacity-60" />
                  {/* Badge utama */}
                  <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-black text-white shadow-md ring-2 ring-white">
                    {displayedNotificationCount > 99 ? "99+" : displayedNotificationCount}
                  </span>
                </>
              )}
            </button>

            <div className="relative">
              <button
                onClick={() => setShowProfile(!showProfile)}
                className="flex items-center gap-2 rounded-full border border-green-100 bg-white px-2 py-2 shadow-sm transition hover:bg-green-50 md:gap-3 md:rounded-2xl md:px-3"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-green-100 text-green-700">
                  👤
                </div>

                <div className="hidden text-left md:block">
                  <p className="max-w-[130px] truncate text-sm font-bold text-gray-900">
                    Halo, {user.nama}
                  </p>
                  <p className="text-xs text-gray-500">
                    {user.role === "pemilik" ? "Pemilik" : "Pengelola"}
                  </p>
                </div>

                <ChevronDown size={16} className="hidden md:block" />
              </button>

              {showProfile && (
                <div className="absolute right-0 top-14 w-72 rounded-3xl border border-green-100 bg-white p-4 shadow-2xl">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-lg">
                      👤
                    </div>

                    <div className="min-w-0">
                      <p className="truncate font-bold">{user.nama}</p>
                      <p className="truncate text-sm text-gray-500">{user.email}</p>
                      <p className="mt-1 text-xs font-semibold text-green-700">
                        {user.role === "pemilik" ? "Pemilik" : "Pengelola"}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={handleLogout}
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-red-500 px-4 py-3 font-semibold text-white hover:bg-red-600"
                  >
                    <LogOut size={18} />
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* MOBILE BOTTOM NAV */}
      {isMobile && (
        <nav
          className="border-t border-green-100 bg-white/95 shadow-[0_-8px_30px_rgba(0,0,0,0.08)] backdrop-blur-xl"
          style={{
            position: "fixed",
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 9999,
            paddingBottom: "env(safe-area-inset-bottom)",
          }}
        >
        <div
          className="mx-auto grid max-w-xl px-2 py-2"
          style={{
            gridTemplateColumns: `repeat(${menus.length}, minmax(0, 1fr))`,
          }}
        >
          {menus.map((item) => {
            const Icon = item.icon
            const active = isActive(item.match)

            return (
              <button
                key={item.path}
                onClick={() => router.push(item.path)}
                className={`flex flex-col items-center justify-center gap-1 rounded-2xl px-1.5 py-2 text-[10px] font-semibold transition-all ${
                  active ? "text-green-700" : "text-gray-500 hover:bg-green-50"
                }`}
              >
                <Icon size={20} />
                <span className="max-w-full truncate">{item.label}</span>
              </button>
            )
          })}
        </div>
      </nav>
      )}
    </>
  )
}