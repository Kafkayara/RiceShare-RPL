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
  tanggal_selesai: string | null
  status: string
  timeline_overrides?: TimelineOverrides | null
  lahan?: Lahan | null
}

type AktivitasLog = {
  id: string
  lahan_id: string
  tanggal: string
  jenis_aktivitas: string
}

type TimelineTemplate = {
  key: string
  label: string
  startOffset: number
  endOffset: number
  type: "aktivitas" | "panen" | "istirahat" | "siap"
}

type TimelineComputedItem = {
  key: string
  label: string
  startDate: string
  endDate: string
  type: TimelineTemplate["type"]
}

type NotificationItem = {
  id: string
  lahan_id: string
  lokasi: string
  title: string
  message: string
  tanggal_mulai: string
  tanggal_selesai: string
  priority: "urgent" | "today" | "soon" | "info"
  type: "terlewat" | "hari_ini" | "mendatang" | "panen" | "siap_tanam"
}

const timelineTemplates: TimelineTemplate[] = [
  {
    key: "mulai_tanam",
    label: "Mulai Tanam",
    startOffset: 0,
    endOffset: 0,
    type: "aktivitas",
  },
  {
    key: "cek_adaptasi_bibit",
    label: "Cek Adaptasi Bibit",
    startOffset: 1,
    endOffset: 7,
    type: "aktivitas",
  },
  {
    key: "pemupukan_1",
    label: "Pemupukan 1",
    startOffset: 7,
    endOffset: 14,
    type: "aktivitas",
  },
  {
    key: "pantau_pertumbuhan_awal",
    label: "Pantau Pertumbuhan Awal",
    startOffset: 14,
    endOffset: 21,
    type: "aktivitas",
  },
  {
    key: "persiapan_pengendalian_gulma",
    label: "Persiapan Pengendalian Gulma",
    startOffset: 21,
    endOffset: 30,
    type: "aktivitas",
  },
  {
    key: "bersihkan_gulma",
    label: "Bersihkan Gulma",
    startOffset: 30,
    endOffset: 30,
    type: "aktivitas",
  },
  {
    key: "pemupukan_2",
    label: "Pemupukan 2",
    startOffset: 35,
    endOffset: 40,
    type: "aktivitas",
  },
  {
    key: "perawatan_lanjutan",
    label: "Perawatan Lanjutan",
    startOffset: 40,
    endOffset: 60,
    type: "aktivitas",
  },
  {
    key: "cek_hama",
    label: "Cek Hama",
    startOffset: 60,
    endOffset: 69,
    type: "aktivitas",
  },
  {
    key: "menjelang_panen",
    label: "Menjelang Panen",
    startOffset: 70,
    endOffset: 85,
    type: "panen",
  },
  {
    key: "panen_estimasi",
    label: "Panen Estimasi",
    startOffset: 80,
    endOffset: 105,
    type: "panen",
  },
  {
    key: "masa_istirahat",
    label: "Masa Istirahat",
    startOffset: 106,
    endOffset: 119,
    type: "istirahat",
  },
  {
    key: "siap_tanam_kembali",
    label: "Siap Tanam Kembali",
    startOffset: 120,
    endOffset: 120,
    type: "siap",
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
    month: "long",
    year: "numeric",
  })
}

function formatRangeDate(startDate: string, endDate: string) {
  if (startDate === endDate) {
    return formatDateId(startDate)
  }

  return `${formatDateId(startDate)} - ${formatDateId(endDate)}`
}

function getNotificationStyle(priority: NotificationItem["priority"]) {
  switch (priority) {
    case "urgent":
      return "border-red-200 bg-red-50 text-red-800"
    case "today":
      return "border-blue-200 bg-blue-50 text-blue-800"
    case "soon":
      return "border-yellow-200 bg-yellow-50 text-yellow-800"
    case "info":
      return "border-green-200 bg-green-50 text-green-800"
    default:
      return "border-gray-200 bg-gray-50 text-gray-800"
  }
}

function getNotificationDot(priority: NotificationItem["priority"]) {
  switch (priority) {
    case "urgent":
      return "bg-red-500"
    case "today":
      return "bg-blue-500"
    case "soon":
      return "bg-yellow-500"
    case "info":
      return "bg-green-500"
    default:
      return "bg-gray-500"
  }
}

function getNotificationLabel(priority: NotificationItem["priority"]) {
  switch (priority) {
    case "urgent":
      return "Perlu Perhatian"
    case "today":
      return "Hari Ini"
    case "soon":
      return "Segera"
    case "info":
      return "Info"
    default:
      return "Info"
  }
}

function buildTimelineItems(jadwal: JadwalTanam): TimelineComputedItem[] {
  const items: TimelineComputedItem[] = []
  const overrides = jadwal.timeline_overrides || {}

  for (let index = 0; index < timelineTemplates.length; index++) {
    const template = timelineTemplates[index]
    const previousTemplate = timelineTemplates[index - 1]
    const previousItem = items[index - 1]

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

    items.push({
      key: template.key,
      label: template.label,
      startDate,
      endDate,
      type: template.type,
    })
  }

  return items
}

function hasLogInRange(
  jadwal: JadwalTanam,
  item: TimelineComputedItem,
  aktivitasLogs: AktivitasLog[]
) {
  return aktivitasLogs.some((log) => {
    return (
      log.lahan_id === jadwal.lahan_id &&
      log.jenis_aktivitas === item.label &&
      log.tanggal >= item.startDate &&
      log.tanggal <= item.endDate
    )
  })
}

function buildNotifications(
  jadwal: JadwalTanam,
  aktivitasLogs: AktivitasLog[],
  today: string
): NotificationItem[] {
  const notifications: NotificationItem[] = []
  const timelineItems = buildTimelineItems(jadwal)
  const lokasi = jadwal.lahan?.lokasi || "Lahan tidak diketahui"

  timelineItems.forEach((item) => {
    const alreadyLogged = hasLogInRange(jadwal, item, aktivitasLogs)

    if (alreadyLogged) {
      return
    }

    const daysUntilStart = differenceInDays(today, item.startDate)
    const daysAfterEnd = differenceInDays(item.endDate, today)

    if (today >= item.startDate && today <= item.endDate) {
      notifications.push({
        id: `${jadwal.id}-${item.key}-today`,
        lahan_id: jadwal.lahan_id,
        lokasi,
        title: `${item.label} - ${lokasi}`,
        message:
          item.startDate === item.endDate
            ? "Aktivitas dijadwalkan hari ini."
            : `Aktivitas sedang dalam periode ${formatRangeDate(
                item.startDate,
                item.endDate
              )}.`,
        tanggal_mulai: item.startDate,
        tanggal_selesai: item.endDate,
        priority: item.type === "panen" ? "soon" : "today",
        type: item.type === "panen" ? "panen" : "hari_ini",
      })

      return
    }

    if (today > item.endDate) {
      /**
       * Biar notifikasi tidak terlalu bising:
       * hanya tampilkan aktivitas terlewat maksimal 30 hari ke belakang.
       */
      if (daysAfterEnd <= 30) {
        notifications.push({
          id: `${jadwal.id}-${item.key}-missed`,
          lahan_id: jadwal.lahan_id,
          lokasi,
          title: `${item.label} terlewat - ${lokasi}`,
          message: `Jadwal berakhir ${daysAfterEnd} hari lalu dan belum ada log aktivitas.`,
          tanggal_mulai: item.startDate,
          tanggal_selesai: item.endDate,
          priority: "urgent",
          type: "terlewat",
        })
      }

      return
    }

    if (daysUntilStart >= 1 && daysUntilStart <= 3) {
      let message = `Dijadwalkan ${daysUntilStart} hari lagi.`
      let priority: NotificationItem["priority"] = "soon"
      let type: NotificationItem["type"] = "mendatang"

      if (item.type === "panen") {
        message = `Periode panen akan masuk ${daysUntilStart} hari lagi.`
        type = "panen"
      }

      if (item.type === "siap") {
        message = `Lahan akan siap tanam kembali ${daysUntilStart} hari lagi.`
        priority = "info"
        type = "siap_tanam"
      }

      notifications.push({
        id: `${jadwal.id}-${item.key}-soon`,
        lahan_id: jadwal.lahan_id,
        lokasi,
        title: `${item.label} - ${lokasi}`,
        message,
        tanggal_mulai: item.startDate,
        tanggal_selesai: item.endDate,
        priority,
        type,
      })
    }
  })

  return notifications
}

export default function NotifikasiPage() {
  const router = useRouter()

  const [user, setUser] = useState<UserProfile | null>(null)
  const [checkingUser, setCheckingUser] = useState(true)
  const [loadingData, setLoadingData] = useState(true)

  const [jadwalList, setJadwalList] = useState<JadwalTanam[]>([])
  const [aktivitasLogs, setAktivitasLogs] = useState<AktivitasLog[]>([])
  const [selectedFilter, setSelectedFilter] = useState("semua")

  const today = getTodayDateInputValue()

  useEffect(() => {
    const savedUser = localStorage.getItem("riceshare_user")

    if (!savedUser) {
      router.push("/")
      return
    }

    setUser(JSON.parse(savedUser))
    setCheckingUser(false)
  }, [router])

  const fetchNotifikasi = async () => {
    setLoadingData(true)

    await syncLahanStatus()

    const { data: jadwalData, error: jadwalError } = await supabase
      .from("jadwal_tanam")
      .select(`
        id,
        lahan_id,
        tanggal_mulai,
        tanggal_selesai,
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
      console.log("FETCH JADWAL NOTIFIKASI ERROR:", jadwalError)
      setLoadingData(false)
      return
    }

    const { data: logData, error: logError } = await supabase
      .from("aktivitas_log")
      .select("id, lahan_id, tanggal, jenis_aktivitas")

    if (logError) {
      console.log("FETCH LOG NOTIFIKASI ERROR:", logError)
    }

    setJadwalList((jadwalData || []) as unknown as JadwalTanam[])
    setAktivitasLogs((logData || []) as AktivitasLog[])
    setLoadingData(false)
  }

  useEffect(() => {
    if (!checkingUser && user) {
      fetchNotifikasi()
    }
  }, [checkingUser, user])

  const notifications = useMemo(() => {
    const list = jadwalList.flatMap((jadwal) =>
      buildNotifications(jadwal, aktivitasLogs, today)
    )

    return list.sort((a, b) => {
      const priorityOrder = {
        urgent: 1,
        today: 2,
        soon: 3,
        info: 4,
      }

      const priorityDiff =
        priorityOrder[a.priority] - priorityOrder[b.priority]

      if (priorityDiff !== 0) return priorityDiff

      return a.tanggal_mulai.localeCompare(b.tanggal_mulai)
    })
  }, [jadwalList, aktivitasLogs, today])

  const filteredNotifications = useMemo(() => {
    if (selectedFilter === "semua") return notifications

    return notifications.filter((notif) => notif.type === selectedFilter)
  }, [notifications, selectedFilter])

  const urgentCount = notifications.filter(
    (notif) => notif.priority === "urgent"
  ).length

  const todayCount = notifications.filter(
    (notif) => notif.priority === "today"
  ).length

  const soonCount = notifications.filter(
    (notif) => notif.priority === "soon"
  ).length

  const infoCount = notifications.filter(
    (notif) => notif.priority === "info"
  ).length

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
      <div className="mx-auto w-full max-w-5xl px-4 py-4 md:px-6 md:py-6">
        <header className="mb-6 flex flex-col gap-4 rounded-2xl border bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium text-green-700">RiceShare</p>
            <h1 className="text-2xl font-bold">Notifikasi</h1>
            <p className="text-sm text-gray-500">
              Pengingat jadwal aktivitas, panen, dan status siklus lahan.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              onClick={fetchNotifikasi}
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

        <section className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="rounded-2xl border bg-red-50 p-4 shadow-sm">
            <p className="text-sm text-red-700">Terlewat</p>
            <h2 className="mt-2 text-2xl font-bold text-red-800">
              {urgentCount}
            </h2>
          </div>

          <div className="rounded-2xl border bg-blue-50 p-4 shadow-sm">
            <p className="text-sm text-blue-700">Hari Ini</p>
            <h2 className="mt-2 text-2xl font-bold text-blue-800">
              {todayCount}
            </h2>
          </div>

          <div className="rounded-2xl border bg-yellow-50 p-4 shadow-sm">
            <p className="text-sm text-yellow-700">Mendatang</p>
            <h2 className="mt-2 text-2xl font-bold text-yellow-800">
              {soonCount}
            </h2>
          </div>

          <div className="rounded-2xl border bg-green-50 p-4 shadow-sm">
            <p className="text-sm text-green-700">Info</p>
            <h2 className="mt-2 text-2xl font-bold text-green-800">
              {infoCount}
            </h2>
          </div>
        </section>

        <section className="mb-6 rounded-2xl border bg-white p-4 shadow-sm">
          <label className="mb-1 block text-sm font-medium">
            Filter Notifikasi
          </label>

          <div className="relative">
            <select
              value={selectedFilter}
              onChange={(e) => setSelectedFilter(e.target.value)}
              className="w-full appearance-none rounded-xl border bg-white px-3 py-2 pr-10 outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="semua">Semua notifikasi</option>
              <option value="terlewat">Terlewat</option>
              <option value="hari_ini">Hari ini</option>
              <option value="mendatang">Mendatang</option>
              <option value="panen">Panen</option>
              <option value="siap_tanam">Siap tanam kembali</option>
            </select>

            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-gray-500">
              ▾
            </span>
          </div>
        </section>

        {loadingData ? (
          <section className="rounded-2xl border bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">Memuat notifikasi...</p>
          </section>
        ) : filteredNotifications.length === 0 ? (
          <section className="rounded-2xl border bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">
              Tidak ada notifikasi untuk saat ini.
            </p>
          </section>
        ) : (
          <section className="space-y-3">
            {filteredNotifications.map((notif) => (
              <article
                key={notif.id}
                className="rounded-2xl border bg-white p-4 shadow-sm transition hover:border-green-300 hover:bg-green-50"
              >
                <div className="flex gap-3">
                  <div
                    className={`mt-1 h-3 w-3 shrink-0 rounded-full ${getNotificationDot(
                      notif.priority
                    )}`}
                  />

                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h2 className="font-bold">{notif.title}</h2>
                        <p className="text-sm text-gray-500">
                          {notif.lokasi}
                        </p>
                      </div>

                      <span
                        className={`w-fit rounded-full border px-3 py-1 text-xs font-medium ${getNotificationStyle(
                          notif.priority
                        )}`}
                      >
                        {getNotificationLabel(notif.priority)}
                      </span>
                    </div>

                    <p className="text-sm text-gray-700">{notif.message}</p>

                    <p className="mt-2 text-xs text-gray-500">
                      Jadwal: {formatRangeDate(notif.tanggal_mulai, notif.tanggal_selesai)}
                    </p>

                    <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                      <button
                        onClick={() => router.push(`/lahan/${notif.lahan_id}`)}
                        className="rounded-xl border px-4 py-2 text-sm font-medium hover:bg-gray-50"
                      >
                        Detail Lahan
                      </button>

                      {isPengelola &&
                        notif.tanggal_mulai <= today &&
                        notif.priority !== "info" && (
                          <button
                            onClick={() =>
                              router.push(
                                `/log/tambah?lahan_id=${notif.lahan_id}&tanggal=${today}`
                              )
                            }
                            className="rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
                          >
                            Tambah Log Aktivitas
                          </button>
                        )}
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </section>
        )}
      </div>
    </main>
  )
}