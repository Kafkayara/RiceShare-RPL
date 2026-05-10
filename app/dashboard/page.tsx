"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { syncLahanStatus } from "@/lib/syncLahanStatus"

type UserProfile = {
  id: string
  nama: string
  email: string
  role: "pemilik" | "pengelola"
}

type TimelineOverrides = Record<string, string>

type Lahan = {
  id: string
  lokasi: string
  luas: number
  status: string
}

type JadwalTanam = {
  id: string
  lahan_id: string
  tanggal_mulai: string
  status: string
  timeline_overrides?: TimelineOverrides | null
  lahan?: Lahan | null
}

type AktivitasLog = {
  id: string
  lahan_id: string
  tanggal: string
  jenis_aktivitas: string
  deskripsi: string | null
  created_at: string | null
  lahan?: {
    lokasi: string
    luas: number
    status: string
  } | null
}

type PanenRecord = {
  id: string
  lahan_id: string
  berat_gkp: number
  tanggal: string
  created_at: string | null
  lahan?: {
    lokasi: string
    luas: number
  } | null
}

type TimelineTemplate = {
  key: string
  label: string
  startOffset: number
  endOffset: number
}

type DashboardNotification = {
  id: string
  lahan_id: string
  title: string
  message: string
  priority: "urgent" | "today" | "soon"
  tanggal: string
}

const timelineTemplates: TimelineTemplate[] = [
  { key: "mulai_tanam", label: "Mulai Tanam", startOffset: 0, endOffset: 0 },
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
  { key: "cek_hama", label: "Cek Hama", startOffset: 60, endOffset: 69 },
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

function toDateInputValue(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")

  return `${year}-${month}-${day}`
}

function addDays(dateString: string, days: number) {
  const date = new Date(dateString)
  date.setDate(date.getDate() + days)

  return toDateInputValue(date)
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
    month: "short",
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

function formatStatus(status?: string | null) {
  if (!status) return "Tidak diketahui"

  const label: Record<string, string> = {
    belum_digunakan: "Belum Digunakan",
    masa_tanam_aktif: "Masa Tanam Aktif",
    menjelang_panen: "Siap Panen",
    panen_selesai: "Panen Selesai",
    istirahat: "Masa Istirahat",
    siap_tanam_kembali: "Siap Tanam",
  }

  return label[status] || status
}

function getNotificationStyle(priority: DashboardNotification["priority"]) {
  switch (priority) {
    case "urgent":
      return "border-red-200 bg-red-50 text-red-700"
    case "today":
      return "border-green-200 bg-green-50 text-green-700"
    case "soon":
      return "border-yellow-200 bg-yellow-50 text-yellow-700"
    default:
      return "border-gray-200 bg-gray-50 text-gray-700"
  }
}

function buildDashboardNotifications(
  jadwalList: JadwalTanam[],
  aktivitasLogs: AktivitasLog[],
  today: string
) {
  const notifications: DashboardNotification[] = []

  jadwalList.forEach((jadwal) => {
    const overrides = jadwal.timeline_overrides || {}
    const lokasi = jadwal.lahan?.lokasi || "Lahan tidak diketahui"

    const computedItems: {
      key: string
      label: string
      startDate: string
      endDate: string
    }[] = []

    timelineTemplates.forEach((template, index) => {
      const previousTemplate = timelineTemplates[index - 1]
      const previousItem = computedItems[index - 1]

      let startDate = ""
      let endDate = ""

      if (index === 0) {
        startDate = jadwal.tanggal_mulai
        endDate = jadwal.tanggal_mulai
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

      computedItems.push({
        key: template.key,
        label: template.label,
        startDate,
        endDate,
      })
    })

    computedItems.forEach((item) => {
      const sudahAdaLog = aktivitasLogs.some((log) => {
        return (
          log.lahan_id === jadwal.lahan_id &&
          log.jenis_aktivitas === item.label &&
          log.tanggal >= item.startDate &&
          log.tanggal <= item.endDate
        )
      })

      if (sudahAdaLog) return

      const daysUntilStart = differenceInDays(today, item.startDate)
      const daysAfterEnd = differenceInDays(item.endDate, today)

      if (today >= item.startDate && today <= item.endDate) {
        notifications.push({
          id: `${jadwal.id}-${item.key}-today`,
          lahan_id: jadwal.lahan_id,
          title: `Hari ini - ${item.label}`,
          message: lokasi,
          priority: "today",
          tanggal: item.startDate,
        })

        return
      }

      if (today > item.endDate && daysAfterEnd <= 14) {
        notifications.push({
          id: `${jadwal.id}-${item.key}-missed`,
          lahan_id: jadwal.lahan_id,
          title: `${item.label} terlewat`,
          message: lokasi,
          priority: "urgent",
          tanggal: item.endDate,
        })

        return
      }

      if (daysUntilStart >= 1 && daysUntilStart <= 3) {
        notifications.push({
          id: `${jadwal.id}-${item.key}-soon`,
          lahan_id: jadwal.lahan_id,
          title:
            daysUntilStart === 1
              ? `Besok - ${item.label}`
              : `${daysUntilStart} hari lagi - ${item.label}`,
          message: lokasi,
          priority: "soon",
          tanggal: item.startDate,
        })
      }
    })
  })

  const priorityOrder = {
    urgent: 1,
    today: 2,
    soon: 3,
  }

  return notifications
    .sort((a, b) => {
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority]
      if (priorityDiff !== 0) return priorityDiff

      return a.tanggal.localeCompare(b.tanggal)
    })
    .slice(0, 4)
}

export default function DashboardPage() {
  const router = useRouter()

  const [user, setUser] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  const [lahanAktif, setLahanAktif] = useState(0)
  const [lahanSiapPanen, setLahanSiapPanen] = useState(0)
  const [lahanIstirahat, setLahanIstirahat] = useState(0)

  const [jadwalList, setJadwalList] = useState<JadwalTanam[]>([])
  const [allAktivitasLogs, setAllAktivitasLogs] = useState<AktivitasLog[]>([])
  const [aktivitasTerbaru, setAktivitasTerbaru] = useState<AktivitasLog[]>([])
  const [panenTerbaru, setPanenTerbaru] = useState<PanenRecord[]>([])
  const [lahanMenjelangPanen, setLahanMenjelangPanen] = useState<Lahan[]>([])
  const [readNotificationIds, setReadNotificationIds] = useState<string[]>([])

  const today = getTodayDateInputValue()

  useEffect(() => {
    const savedUser = localStorage.getItem("riceshare_user")

    if (!savedUser) {
      router.push("/")
      return
    }

    const parsedUser = JSON.parse(savedUser) as UserProfile
    setUser(parsedUser)
  }, [router])

  const fetchDashboardData = async () => {
    if (!user) return

    setLoading(true)

    await syncLahanStatus()

    const { data: lahanData, error: lahanError } = await supabase
      .from("lahan")
      .select("id, lokasi, luas, status")
      .order("lokasi", { ascending: true })

    if (lahanError) {
      console.log("FETCH DASHBOARD LAHAN ERROR:", lahanError)
    }

    const lahanRows = (lahanData || []) as Lahan[]

    setLahanAktif(
      lahanRows.filter((lahan) => lahan.status === "masa_tanam_aktif").length
    )
    setLahanSiapPanen(
      lahanRows.filter((lahan) => lahan.status === "menjelang_panen").length
    )
    setLahanIstirahat(
      lahanRows.filter((lahan) => lahan.status === "istirahat").length
    )

    const { data: jadwalData, error: jadwalError } = await supabase
      .from("jadwal_tanam")
      .select(`
        id,
        lahan_id,
        tanggal_mulai,
        status,
        timeline_overrides,
        lahan (
          id,
          lokasi,
          luas,
          status
        )
      `)
      .in("status", [
        "masa_tanam_aktif",
        "menjelang_panen",
        "panen_selesai",
        "istirahat",
        "siap_tanam_kembali",
      ])
      .order("tanggal_mulai", { ascending: false })

    if (jadwalError) {
      console.log("FETCH DASHBOARD JADWAL ERROR:", jadwalError)
    }

    const { data: allLogData, error: allLogError } = await supabase
      .from("aktivitas_log")
      .select(`
        id,
        lahan_id,
        tanggal,
        jenis_aktivitas,
        deskripsi,
        created_at,
        lahan (
          lokasi,
          luas,
          status
        )
      `)

    if (allLogError) {
      console.log("FETCH DASHBOARD ALL LOG ERROR:", allLogError)
    }

    const { data: latestLogData, error: latestLogError } = await supabase
      .from("aktivitas_log")
      .select(`
        id,
        lahan_id,
        tanggal,
        jenis_aktivitas,
        deskripsi,
        created_at,
        lahan (
          lokasi,
          luas,
          status
        )
      `)
      .order("tanggal", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(4)

    if (latestLogError) {
      console.log("FETCH DASHBOARD LATEST LOG ERROR:", latestLogError)
    }

    const { data: latestPanenData, error: latestPanenError } = await supabase
      .from("panen")
      .select(`
        id,
        lahan_id,
        berat_gkp,
        tanggal,
        created_at,
        lahan (
          lokasi,
          luas
        )
      `)
      .order("tanggal", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(4)

    if (latestPanenError) {
      console.log("FETCH DASHBOARD PANEN ERROR:", latestPanenError)
    }

    const { data: menjelangPanenData, error: menjelangPanenError } =
      await supabase
        .from("lahan")
        .select("id, lokasi, luas, status")
        .eq("status", "menjelang_panen")
        .order("lokasi", { ascending: true })
        .limit(4)

    if (menjelangPanenError) {
      console.log("FETCH DASHBOARD MENJELANG PANEN ERROR:", menjelangPanenError)
    }

    setJadwalList((jadwalData || []) as unknown as JadwalTanam[])
    setAllAktivitasLogs((allLogData || []) as unknown as AktivitasLog[])
    setAktivitasTerbaru((latestLogData || []) as unknown as AktivitasLog[])
    setPanenTerbaru((latestPanenData || []) as unknown as PanenRecord[])
    setLahanMenjelangPanen((menjelangPanenData || []) as Lahan[])

    setLoading(false)
  }

  useEffect(() => {
    if (user) {
      fetchDashboardData()
    }
  }, [user])

  const notifications = useMemo(() => {
    return buildDashboardNotifications(jadwalList, allAktivitasLogs, today)
  }, [jadwalList, allAktivitasLogs, today])

  useEffect(() => {
    const savedReadIds = localStorage.getItem("riceshare_read_notifications")

    if (savedReadIds) {
      try {
        setReadNotificationIds(JSON.parse(savedReadIds))
      } catch {
        setReadNotificationIds([])
      }
    }
  }, [])

  const unreadNotifications = useMemo(() => {
    return notifications.filter(
      (notif) => !readNotificationIds.includes(notif.id)
    )
  }, [notifications, readNotificationIds])

  const handleOpenNotifications = () => {
    const currentNotificationIds = notifications.map((notif) => notif.id)
    const mergedReadIds = Array.from(
      new Set([...readNotificationIds, ...currentNotificationIds])
    )

    localStorage.setItem(
      "riceshare_read_notifications",
      JSON.stringify(mergedReadIds)
    )

    setReadNotificationIds(mergedReadIds)
    router.push("/notifikasi")
  }

  const handleLogout = () => {
    localStorage.removeItem("riceshare_user")
    router.push("/")
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 p-6 text-gray-900">
        Loading...
      </main>
    )
  }

  if (!user) return null

  const isPemilik = user.role === "pemilik"
  const isPengelola = user.role === "pengelola"

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900">
      <div className="flex min-h-screen">
        <aside className="hidden w-64 shrink-0 border-r bg-white p-5 lg:block">
          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-green-100 text-xl">
              🌾
            </div>

            <div>
              <h1 className="font-bold">RiceShare</h1>
              <p className="text-xs text-gray-500">
                {isPemilik ? "Pemilik" : "Pengelola"}
              </p>
            </div>
          </div>

          <nav className="space-y-2 text-sm font-medium">
            <button
              onClick={() => router.push("/dashboard")}
              className="flex w-full items-center gap-3 rounded-xl bg-green-50 px-4 py-3 text-left text-green-700"
            >
              <span>⌂</span>
              Dashboard
            </button>

            <button
              onClick={() => router.push("/lahan")}
              className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left hover:bg-gray-50"
            >
              <span>▣</span>
              Status Lahan
            </button>

            <button
              onClick={() => router.push("/kalender")}
              className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left hover:bg-gray-50"
            >
              <span>□</span>
              Kalender Tanam
            </button>

            <button
              onClick={handleOpenNotifications}
              className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left hover:bg-gray-50"
            >
              <span>◌</span>
              Notifikasi
              {unreadNotifications.length > 0 && (
                <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
                  {unreadNotifications.length}
                </span>
              )}
            </button>

            <button
              onClick={() => router.push("/log")}
              className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left hover:bg-gray-50"
            >
              <span>☷</span>
              Lihat Log Aktivitas
            </button>

            <button
              onClick={() => router.push("/panen/riwayat")}
              className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left hover:bg-gray-50"
            >
              <span>▤</span>
              Riwayat Panen
            </button>

            <button
              onClick={() => router.push("/laporan")}
              className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left hover:bg-gray-50"
            >
              <span>▧</span>
              Laporan
            </button>

            {isPemilik && (
              <>
                <div className="my-3 border-t" />

                <button
                  onClick={() => router.push("/pengelola")}
                  className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left hover:bg-gray-50"
                >
                  <span>👥</span>
                  Kelola Pengelola
                </button>
              </>
            )}

            {isPengelola && (
              <>
                <div className="my-3 border-t" />

                <button
                  onClick={() => router.push("/tanam")}
                  className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left hover:bg-gray-50"
                >
                  <span>＋</span>
                  Mulai Tanam
                </button>

                <button
                  onClick={() => router.push("/log/tambah")}
                  className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left hover:bg-gray-50"
                >
                  <span>✎</span>
                  Tambah Log Aktivitas
                </button>

                <button
                  onClick={() => router.push("/panen")}
                  className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left hover:bg-gray-50"
                >
                  <span>▥</span>
                  Input Panen
                </button>
              </>
            )}
          </nav>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-20 border-b bg-white/90 px-4 py-4 backdrop-blur md:px-6">
            <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-green-700">RiceShare</p>
                <h1 className="text-xl font-bold md:text-2xl">
                  {isPemilik ? "Dashboard Pemilik" : "Dashboard Pengelola"}
                </h1>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleOpenNotifications}
                  className="relative rounded-xl border px-3 py-2 text-sm hover:bg-gray-50"
                >
                  🔔
                  {unreadNotifications.length > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                      {unreadNotifications.length}
                    </span>
                  )}
                </button>

                <button
                  onClick={fetchDashboardData}
                  className="rounded-xl border px-3 py-2 text-sm font-medium hover:bg-gray-50"
                  title="Refresh"
                >
                  ↻
                </button>

                <div className="overflow-hidden rounded-xl border bg-white">
                  <div className="flex items-center gap-2 border-b px-3 py-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100">
                      👤
                    </div>

                    <div className="hidden sm:block">
                      <p className="text-sm font-semibold leading-tight">
                        {user.nama}
                      </p>
                      <p className="text-xs leading-tight text-gray-500">
                        {isPemilik ? "Pemilik" : "Pengelola"}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={handleLogout}
                    className="block w-full px-3 py-2 text-center text-xs font-semibold text-red-600 hover:bg-red-50"
                  >
                    Logout
                  </button>
                </div>
              </div>
            </div>
          </header>

          <div className="mx-auto max-w-7xl px-4 py-6 md:px-6">
            <section className="mb-6">
              <h2 className="mb-4 text-lg font-bold">Ringkasan Lahan</h2>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-green-200 bg-green-50 p-5 shadow-sm">
                  <p className="text-4xl font-bold text-green-700">
                    {lahanAktif}
                  </p>
                  <p className="mt-2 font-semibold text-gray-900">
                    Lahan Aktif
                  </p>
                </div>

                <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-5 shadow-sm">
                  <p className="text-4xl font-bold text-yellow-700">
                    {lahanSiapPanen}
                  </p>
                  <p className="mt-2 font-semibold text-gray-900">
                    Siap Panen
                  </p>
                </div>

                <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5 shadow-sm">
                  <p className="text-4xl font-bold text-blue-700">
                    {lahanIstirahat}
                  </p>
                  <p className="mt-2 font-semibold text-gray-900">
                    Masa Istirahat
                  </p>
                </div>

                <div className="rounded-2xl border border-red-200 bg-red-50 p-5 shadow-sm">
                  <p className="text-4xl font-bold text-red-700">
                    {notifications.length}
                  </p>
                  <p className="mt-2 font-semibold text-gray-900">
                    Perlu Perhatian
                  </p>
                </div>
              </div>
            </section>

            {/* ══════════════════════════════════════════════════════════════
                LAYOUT PEMILIK — sesuai wireflow screen 3
            ══════════════════════════════════════════════════════════════ */}
            {isPemilik && (
              <>
                {/* Baris 1: Ringkasan Lahan | Aktivitas Terbaru | Estimasi Panen */}
                <section className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">

                  {/* Ringkasan Lahan (tabel status per lahan) */}
                  <div className="rounded-2xl border bg-white p-5 shadow-sm">
                    <div className="mb-4 flex items-center justify-between">
                      <h2 className="text-lg font-bold">Ringkasan Lahan</h2>
                      <button
                        onClick={() => router.push("/lahan")}
                        className="text-sm font-semibold text-blue-600 hover:underline"
                      >
                        Lihat Status Lahan →
                      </button>
                    </div>

                    {jadwalList.length === 0 ? (
                      <p className="rounded-xl bg-gray-50 p-4 text-sm text-gray-500">
                        Belum ada data lahan aktif.
                      </p>
                    ) : (
                      <div className="divide-y">
                        {jadwalList.slice(0, 4).map((jadwal) => {
                          const lokasi = jadwal.lahan?.lokasi || "Lahan"
                          const status = jadwal.lahan?.status || ""
                          const overrides = jadwal.timeline_overrides || {}

                          // Hitung progress hari tanam
                          const hariTanam = differenceInDays(
                            jadwal.tanggal_mulai,
                            today
                          )
                          const totalHari = 105
                          const pct = Math.min(
                            Math.max(
                              Math.round((hariTanam / totalHari) * 100),
                              0
                            ),
                            100
                          )

                          const statusColor =
                            status === "masa_tanam_aktif"
                              ? "text-green-700"
                              : status === "menjelang_panen"
                              ? "text-yellow-700"
                              : status === "istirahat"
                              ? "text-gray-500"
                              : "text-blue-700"

                          return (
                            <button
                              key={jadwal.id}
                              onClick={() =>
                                router.push(`/lahan/${jadwal.lahan_id}`)
                              }
                              className="flex w-full items-center justify-between py-3 text-left hover:bg-gray-50"
                            >
                              <div className="min-w-0 flex-1">
                                <p className="truncate font-semibold">
                                  {lokasi}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {formatStatus(status)}
                                </p>
                              </div>
                              <div className="ml-3 flex shrink-0 items-center gap-2">
                                <div className="h-1.5 w-16 overflow-hidden rounded-full bg-gray-200">
                                  <div
                                    className={`h-full rounded-full ${
                                      status === "menjelang_panen"
                                        ? "bg-yellow-500"
                                        : status === "istirahat"
                                        ? "bg-gray-400"
                                        : "bg-green-500"
                                    }`}
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                                <span className={`text-xs font-bold ${statusColor}`}>
                                  {pct}%
                                </span>
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  {/* Aktivitas Terbaru */}
                  <div className="rounded-2xl border bg-white p-5 shadow-sm">
                    <div className="mb-4 flex items-center justify-between">
                      <h2 className="text-lg font-bold">Aktivitas Terbaru</h2>
                    </div>

                    {aktivitasTerbaru.length === 0 ? (
                      <p className="rounded-xl bg-gray-50 p-4 text-sm text-gray-500">
                        Belum ada aktivitas tercatat.
                      </p>
                    ) : (
                      <div className="divide-y">
                        {aktivitasTerbaru.map((log) => (
                          <button
                            key={log.id}
                            onClick={() => router.push(`/log/${log.id}`)}
                            className="block w-full py-3 text-left hover:bg-gray-50"
                          >
                            <p className="font-semibold">
                              {log.lahan?.lokasi || "Lahan"}
                            </p>
                            <p className="text-sm text-gray-500">
                              {log.jenis_aktivitas} •{" "}
                              {formatDateId(log.tanggal)}
                            </p>
                          </button>
                        ))}
                      </div>
                    )}

                    <button
                      onClick={() => router.push("/log")}
                      className="mt-4 text-sm font-semibold text-blue-600 hover:underline"
                    >
                      Lihat Semua Aktivitas
                    </button>
                  </div>

                  {/* Estimasi Panen Terdekat */}
                  <div className="rounded-2xl border bg-white p-5 shadow-sm">
                    <div className="mb-4 flex items-center justify-between">
                      <h2 className="text-lg font-bold">Estimasi Panen Terdekat</h2>
                      <button
                        onClick={() => router.push("/kalender")}
                        className="text-sm font-semibold text-blue-600 hover:underline"
                      >
                        Lihat Kalender
                      </button>
                    </div>

                    {lahanMenjelangPanen.length === 0 && jadwalList.filter(j => j.lahan?.status === "masa_tanam_aktif").length === 0 ? (
                      <p className="rounded-xl bg-gray-50 p-4 text-sm text-gray-500">
                        Belum ada estimasi panen.
                      </p>
                    ) : (
                      <div className="divide-y">
                        {jadwalList
                          .filter(
                            (j) =>
                              j.lahan?.status === "menjelang_panen" ||
                              j.lahan?.status === "masa_tanam_aktif"
                          )
                          .slice(0, 4)
                          .map((jadwal) => {
                            const estimasiPanen = addDays(
                              jadwal.tanggal_mulai,
                              80
                            )
                            const overrides = jadwal.timeline_overrides || {}
                            const tanggalPanen =
                              (overrides["panen_estimasi"] as string) ||
                              estimasiPanen

                            return (
                              <button
                                key={jadwal.id}
                                onClick={() =>
                                  router.push(`/lahan/${jadwal.lahan_id}`)
                                }
                                className="flex w-full items-center justify-between py-3 text-left hover:bg-gray-50"
                              >
                                <p className="font-semibold">
                                  {jadwal.lahan?.lokasi || "Lahan"}
                                </p>
                                <p className="text-sm font-medium text-green-700">
                                  {formatDateId(tanggalPanen)}
                                </p>
                              </button>
                            )
                          })}
                      </div>
                    )}
                  </div>
                </section>

                {/* Baris 2: Notifikasi Penting | Aksi Cepat */}
                <section className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">

                  {/* Notifikasi Penting (span 2 kolom) */}
                  <div className="rounded-2xl border bg-white p-5 shadow-sm lg:col-span-2">
                    <div className="mb-4 flex items-center justify-between">
                      <h2 className="text-lg font-bold">Notifikasi Penting</h2>
                      <button
                        onClick={handleOpenNotifications}
                        className="text-sm font-semibold text-blue-600 hover:underline"
                      >
                        Lihat Semua Notifikasi
                      </button>
                    </div>

                    {notifications.length === 0 ? (
                      <p className="rounded-xl bg-gray-50 p-4 text-sm text-gray-500">
                        Tidak ada notifikasi penting saat ini.
                      </p>
                    ) : (
                      <ul className="space-y-2">
                        {notifications.map((notif) => (
                          <li key={notif.id}>
                            <button
                              onClick={() =>
                                router.push(`/lahan/${notif.lahan_id}`)
                              }
                              className="flex w-full items-start gap-3 rounded-xl p-3 text-left hover:bg-gray-50"
                            >
                              <span
                                className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${
                                  notif.priority === "urgent"
                                    ? "bg-red-500"
                                    : notif.priority === "today"
                                    ? "bg-green-500"
                                    : "bg-yellow-400"
                                }`}
                              />
                              <div className="min-w-0 flex-1">
                                <p className="font-semibold leading-snug">
                                  {notif.title} —{" "}
                                  <span className="font-normal text-gray-600">
                                    {notif.message}
                                  </span>
                                </p>
                                <p className="text-xs text-gray-400">
                                  {formatDateId(notif.tanggal)}
                                </p>
                              </div>
                              <span
                                className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium ${getNotificationStyle(
                                  notif.priority
                                )}`}
                              >
                                {notif.priority === "urgent"
                                  ? "Terlewat"
                                  : notif.priority === "today"
                                  ? "Hari ini"
                                  : "Segera"}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Aksi Cepat Pemilik */}
                  <div className="rounded-2xl border bg-white p-5 shadow-sm">
                    <h2 className="mb-4 text-lg font-bold">Aksi Cepat</h2>
                    <div className="space-y-3">
                      <button
                        onClick={() => router.push("/lahan")}
                        className="w-full rounded-xl bg-green-600 px-4 py-3 font-semibold text-white hover:bg-green-700"
                      >
                        Lihat Status Lahan
                      </button>
                      <button
                        onClick={() => router.push("/laporan")}
                        className="w-full rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700"
                      >
                        Lihat Laporan
                      </button>
                      <button
                        onClick={() => router.push("/pengelola")}
                        className="w-full rounded-xl border border-green-200 bg-green-50 px-4 py-3 font-semibold text-green-700 hover:bg-green-100"
                      >
                        Kelola Pengelola
                      </button>
                    </div>
                  </div>
                </section>
              </>
            )}

            {/* ══════════════════════════════════════════════════════════════
                LAYOUT PENGELOLA — layout asli
            ══════════════════════════════════════════════════════════════ */}
            {isPengelola && (
              <>
                <section className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
                  {/* Jadwal Terdekat */}
                  <div className="rounded-2xl border bg-white p-5 shadow-sm">
                    <div className="mb-4 flex items-center justify-between">
                      <h2 className="text-lg font-bold">Jadwal Terdekat</h2>
                    </div>

                    {notifications.length === 0 ? (
                      <p className="rounded-xl bg-gray-50 p-4 text-sm text-gray-500">
                        Tidak ada jadwal penting.
                      </p>
                    ) : (
                      <div className="divide-y">
                        {notifications.map((notif) => (
                          <button
                            key={notif.id}
                            onClick={() =>
                              router.push(`/lahan/${notif.lahan_id}`)
                            }
                            className="block w-full py-3 text-left hover:bg-gray-50"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="font-semibold">{notif.title}</p>
                                <p className="text-sm text-gray-500">
                                  {notif.message}
                                </p>
                              </div>
                              <span
                                className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium ${getNotificationStyle(
                                  notif.priority
                                )}`}
                              >
                                {notif.priority === "urgent"
                                  ? "Terlewat"
                                  : notif.priority === "today"
                                  ? "Hari ini"
                                  : "Segera"}
                              </span>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}

                    <button
                      onClick={handleOpenNotifications}
                      className="mt-4 text-sm font-semibold text-blue-600 hover:underline"
                    >
                      Lihat Semua Jadwal
                    </button>
                  </div>

                  {/* Aktivitas Terbaru */}
                  <div className="rounded-2xl border bg-white p-5 shadow-sm">
                    <div className="mb-4 flex items-center justify-between">
                      <h2 className="text-lg font-bold">Aktivitas Terbaru</h2>
                    </div>

                    {aktivitasTerbaru.length === 0 ? (
                      <p className="rounded-xl bg-gray-50 p-4 text-sm text-gray-500">
                        Belum ada aktivitas tercatat.
                      </p>
                    ) : (
                      <div className="divide-y">
                        {aktivitasTerbaru.map((log) => (
                          <button
                            key={log.id}
                            onClick={() => router.push(`/log/${log.id}`)}
                            className="block w-full py-3 text-left hover:bg-gray-50"
                          >
                            <p className="font-semibold">
                              {log.jenis_aktivitas} -{" "}
                              {log.lahan?.lokasi || "Lahan"}
                            </p>
                            <p className="text-sm text-gray-500">
                              {formatDateId(log.tanggal)}
                            </p>
                          </button>
                        ))}
                      </div>
                    )}

                    <button
                      onClick={() => router.push("/log")}
                      className="mt-4 text-sm font-semibold text-blue-600 hover:underline"
                    >
                      Lihat Semua Aktivitas
                    </button>
                  </div>

                  {/* Aksi Cepat Pengelola */}
                  <div className="rounded-2xl border bg-white p-5 shadow-sm">
                    <h2 className="mb-4 text-lg font-bold">Aksi Cepat</h2>
                    <div className="space-y-3">
                      <button
                        onClick={() => router.push("/tanam")}
                        className="w-full rounded-xl bg-green-600 px-4 py-3 font-semibold text-white hover:bg-green-700"
                      >
                        Mulai Tanam
                      </button>
                      <button
                        onClick={() => router.push("/log/tambah")}
                        className="w-full rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700"
                      >
                        Input Log Aktivitas
                      </button>
                      <button
                        onClick={() => router.push("/panen")}
                        className="w-full rounded-xl bg-yellow-500 px-4 py-3 font-semibold text-white hover:bg-yellow-600"
                      >
                        Input Panen
                      </button>
                      <button
                        onClick={() => router.push("/lahan")}
                        className="w-full rounded-xl border px-4 py-3 font-semibold hover:bg-gray-50"
                      >
                        Lihat Status Lahan
                      </button>
                    </div>
                  </div>
                </section>

                <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  {/* Panen Terbaru */}
                  <div className="rounded-2xl border bg-white p-5 shadow-sm">
                    <div className="mb-4 flex items-center justify-between">
                      <h2 className="text-lg font-bold">Panen Terbaru</h2>
                      <button
                        onClick={() => router.push("/panen/riwayat")}
                        className="rounded-xl border px-3 py-2 text-sm font-medium hover:bg-gray-50"
                      >
                        Lihat Semua
                      </button>
                    </div>

                    {panenTerbaru.length === 0 ? (
                      <p className="rounded-xl bg-gray-50 p-4 text-sm text-gray-500">
                        Belum ada data panen.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {panenTerbaru.map((panen) => (
                          <article
                            key={panen.id}
                            onClick={() => router.push("/panen/riwayat")}
                            className="cursor-pointer rounded-xl border bg-gray-50 p-3 hover:border-green-300 hover:bg-green-50"
                          >
                            <h3 className="font-bold">
                              {panen.lahan?.lokasi || "Lahan tidak diketahui"}
                            </h3>
                            <p className="text-sm text-gray-600">
                              {formatDateId(panen.tanggal)} •{" "}
                              {formatKg(panen.berat_gkp)} kg GKP
                            </p>
                          </article>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Lahan Menjelang Panen */}
                  <div className="rounded-2xl border bg-white p-5 shadow-sm">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <h2 className="text-lg font-bold">Lahan Menjelang Panen</h2>
                      <div className="flex gap-2">
                        <button
                          onClick={() => router.push("/kalender")}
                          className="rounded-xl border px-3 py-2 text-sm font-medium hover:bg-gray-50"
                        >
                          Kalender
                        </button>
                        <button
                          onClick={() => router.push("/lahan")}
                          className="rounded-xl border px-3 py-2 text-sm font-medium hover:bg-gray-50"
                        >
                          Lihat Lahan
                        </button>
                      </div>
                    </div>

                    {lahanMenjelangPanen.length === 0 ? (
                      <p className="rounded-xl bg-gray-50 p-4 text-sm text-gray-500">
                        Belum ada lahan menjelang panen.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {lahanMenjelangPanen.map((lahan) => (
                          <article
                            key={lahan.id}
                            onClick={() => router.push(`/lahan/${lahan.id}`)}
                            className="cursor-pointer rounded-xl border bg-gray-50 p-3 hover:border-green-300 hover:bg-green-50"
                          >
                            <span className="mb-2 inline-block rounded-full border border-yellow-200 bg-yellow-50 px-3 py-1 text-xs font-medium text-yellow-700">
                              {formatStatus(lahan.status)}
                            </span>
                            <h3 className="font-bold">{lahan.lokasi}</h3>
                            <p className="text-sm text-gray-600">
                              {lahan.luas} m²
                            </p>
                          </article>
                        ))}
                      </div>
                    )}
                  </div>
                </section>
              </>
            )}

          </div>
        </div>
      </div>
    </main>
  )
}