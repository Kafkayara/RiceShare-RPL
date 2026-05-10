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
  varietas_padi: string | null
  jumlah_benih: number | null
  catatan: string | null
  timeline_overrides?: TimelineOverrides | null
  created_at: string | null
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
  shortLabel: string
  startOffset: number
  endOffset: number
  color: string
  dotColor: string
  description: string
}

type KalenderItem = {
  key: string
  label: string
  shortLabel: string
  description: string
  lahan_id: string
  jadwal_id: string
  lokasi: string
  luas: number
  status_lahan: string
  tanggal_mulai: string
  tanggal_selesai: string
  tanggal_text: string
  status_jadwal: "selesai" | "hari_ini" | "mendatang" | "terlewat"
  color: string
  dotColor: string
}

const timelineTemplates: TimelineTemplate[] = [
  {
    key: "mulai_tanam",
    label: "Mulai Tanam",
    shortLabel: "Mulai",
    startOffset: 0,
    endOffset: 0,
    color: "bg-purple-100 text-purple-700 border-purple-200",
    dotColor: "bg-purple-500",
    description: "Melakukan pindah tanam bibit ke lahan utama.",
  },
  {
    key: "cek_adaptasi_bibit",
    label: "Cek Adaptasi Bibit",
    shortLabel: "Bibit",
    startOffset: 1,
    endOffset: 7,
    color: "bg-green-100 text-green-700 border-green-200",
    dotColor: "bg-green-500",
    description: "Mengecek kondisi bibit setelah pindah tanam.",
  },
  {
    key: "pemupukan_1",
    label: "Pemupukan 1",
    shortLabel: "Pupuk",
    startOffset: 7,
    endOffset: 14,
    color: "bg-green-100 text-green-700 border-green-200",
    dotColor: "bg-green-500",
    description: "Memberikan pupuk awal untuk mendukung pertumbuhan tanaman.",
  },
  {
    key: "pantau_pertumbuhan_awal",
    label: "Pantau Pertumbuhan Awal",
    shortLabel: "Pantau",
    startOffset: 14,
    endOffset: 21,
    color: "bg-green-100 text-green-700 border-green-200",
    dotColor: "bg-green-500",
    description:
      "Memantau warna daun, tinggi tanaman, dan kondisi pertumbuhan awal.",
  },
  {
    key: "persiapan_pengendalian_gulma",
    label: "Persiapan Pengendalian Gulma",
    shortLabel: "Gulma",
    startOffset: 21,
    endOffset: 30,
    color: "bg-green-100 text-green-700 border-green-200",
    dotColor: "bg-green-500",
    description: "Mengamati dan menyiapkan pembersihan rumput atau gulma.",
  },
  {
    key: "bersihkan_gulma",
    label: "Bersihkan Gulma",
    shortLabel: "Gulma",
    startOffset: 30,
    endOffset: 30,
    color: "bg-green-100 text-green-700 border-green-200",
    dotColor: "bg-green-500",
    description: "Membersihkan gulma agar tidak mengganggu tanaman padi.",
  },
  {
    key: "pemupukan_2",
    label: "Pemupukan 2",
    shortLabel: "Pupuk",
    startOffset: 35,
    endOffset: 40,
    color: "bg-green-100 text-green-700 border-green-200",
    dotColor: "bg-green-500",
    description: "Memberikan pupuk lanjutan jika tanaman membutuhkan.",
  },
  {
    key: "perawatan_lanjutan",
    label: "Perawatan Lanjutan",
    shortLabel: "Rawat",
    startOffset: 40,
    endOffset: 60,
    color: "bg-green-100 text-green-700 border-green-200",
    dotColor: "bg-green-500",
    description:
      "Menjaga kondisi air, pematang, saluran air, dan kesehatan tanaman.",
  },
  {
    key: "cek_hama",
    label: "Cek Hama",
    shortLabel: "Hama",
    startOffset: 60,
    endOffset: 69,
    color: "bg-yellow-100 text-yellow-700 border-yellow-200",
    dotColor: "bg-yellow-500",
    description:
      "Memperketat pengawasan terhadap hama dan tanda penyakit menjelang masa panen.",
  },
  {
    key: "menjelang_panen",
    label: "Menjelang Panen",
    shortLabel: "Panen",
    startOffset: 70,
    endOffset: 85,
    color: "bg-red-100 text-red-700 border-red-200",
    dotColor: "bg-red-500",
    description:
      "Menjaga tanaman saat bulir mulai matang dan memperkirakan waktu panen.",
  },
  {
    key: "panen_estimasi",
    label: "Panen Estimasi",
    shortLabel: "Panen",
    startOffset: 80,
    endOffset: 105,
    color: "bg-red-100 text-red-700 border-red-200",
    dotColor: "bg-red-500",
    description: "Periode estimasi panen padi.",
  },
  {
    key: "masa_istirahat",
    label: "Masa Istirahat",
    shortLabel: "Istirahat",
    startOffset: 106,
    endOffset: 119,
    color: "bg-blue-100 text-blue-700 border-blue-200",
    dotColor: "bg-blue-500",
    description:
      "Masa jeda untuk mengistirahatkan atau memulihkan kondisi lahan.",
  },
  {
    key: "siap_tanam_kembali",
    label: "Siap Tanam Kembali",
    shortLabel: "Siap",
    startOffset: 120,
    endOffset: 120,
    color: "bg-purple-100 text-purple-700 border-purple-200",
    dotColor: "bg-purple-500",
    description:
      "Lahan sudah bisa dipakai kembali untuk musim tanam berikutnya.",
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

function formatDateId(dateString?: string | null) {
  if (!dateString) return "-"

  return new Date(dateString).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

function formatMonthYear(date: Date) {
  return date.toLocaleDateString("id-ID", {
    month: "long",
    year: "numeric",
  })
}

function formatTimelineDate(startDate: string, endDate: string) {
  if (startDate === endDate) return formatDateId(endDate)
  return `${formatDateId(startDate)} - ${formatDateId(endDate)}`
}

function getStatusJadwalStyle(status: KalenderItem["status_jadwal"]) {
  switch (status) {
    case "selesai":
      return "border-green-200 bg-green-50 text-green-700"
    case "hari_ini":
      return "border-blue-200 bg-blue-50 text-blue-700"
    case "mendatang":
      return "border-gray-200 bg-gray-50 text-gray-700"
    case "terlewat":
      return "border-red-200 bg-red-50 text-red-700"
    default:
      return "border-gray-200 bg-gray-50 text-gray-700"
  }
}

function getStatusJadwalLabel(status: KalenderItem["status_jadwal"]) {
  switch (status) {
    case "selesai":
      return "Selesai"
    case "hari_ini":
      return "Hari Ini"
    case "mendatang":
      return "Terjadwal"
    case "terlewat":
      return "Terlewat"
    default:
      return status
  }
}

function buildKalenderItems(
  jadwal: JadwalTanam,
  aktivitasLogs: AktivitasLog[],
  today: string
): KalenderItem[] {
  const items: KalenderItem[] = []
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

      startDate = addDays(previousItem.tanggal_selesai, gapFromPrevious)
      endDate = addDays(startDate, duration)
    }

    if (overrides[template.key]) {
      endDate = overrides[template.key]

      if (template.startOffset === template.endOffset) {
        startDate = endDate
      }
    }

    const sudahAdaLog = aktivitasLogs.some((log) => {
      return (
        log.lahan_id === jadwal.lahan_id &&
        log.jenis_aktivitas === template.label &&
        log.tanggal >= startDate &&
        log.tanggal <= endDate
      )
    })

    let statusJadwal: KalenderItem["status_jadwal"] = "mendatang"

    if (sudahAdaLog) {
      statusJadwal = "selesai"
    } else if (today >= startDate && today <= endDate) {
      statusJadwal = "hari_ini"
    } else if (today > endDate) {
      statusJadwal = "terlewat"
    } else {
      statusJadwal = "mendatang"
    }

    items.push({
      key: `${jadwal.id}-${template.key}`,
      label: template.label,
      shortLabel: template.shortLabel,
      description: template.description,
      lahan_id: jadwal.lahan_id,
      jadwal_id: jadwal.id,
      lokasi: jadwal.lahan?.lokasi || "Lahan tidak diketahui",
      luas: jadwal.lahan?.luas || 0,
      status_lahan: jadwal.lahan?.status || jadwal.status,
      tanggal_mulai: startDate,
      tanggal_selesai: endDate,
      tanggal_text: formatTimelineDate(startDate, endDate),
      status_jadwal: statusJadwal,
      color: template.color,
      dotColor: template.dotColor,
    })
  }

  return items
}

function getCalendarDays(currentMonth: Date) {
  const year = currentMonth.getFullYear()
  const month = currentMonth.getMonth()

  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)

  const firstDayIndexMonday = (firstDay.getDay() + 6) % 7
  const totalDays = lastDay.getDate()

  const days: {
    date: Date
    dateValue: string
    dayNumber: number
    isCurrentMonth: boolean
  }[] = []

  for (let i = firstDayIndexMonday; i > 0; i--) {
    const date = new Date(year, month, 1 - i)

    days.push({
      date,
      dateValue: toDateInputValue(date),
      dayNumber: date.getDate(),
      isCurrentMonth: false,
    })
  }

  for (let day = 1; day <= totalDays; day++) {
    const date = new Date(year, month, day)

    days.push({
      date,
      dateValue: toDateInputValue(date),
      dayNumber: day,
      isCurrentMonth: true,
    })
  }

  while (days.length % 7 !== 0) {
    const lastDate = days[days.length - 1].date
    const date = new Date(lastDate)
    date.setDate(lastDate.getDate() + 1)

    days.push({
      date,
      dateValue: toDateInputValue(date),
      dayNumber: date.getDate(),
      isCurrentMonth: false,
    })
  }

  return days
}

function isItemOnDate(item: KalenderItem, dateValue: string) {
  return dateValue >= item.tanggal_mulai && dateValue <= item.tanggal_selesai
}

export default function KalenderPage() {
  const router = useRouter()

  const [user, setUser] = useState<UserProfile | null>(null)
  const [checkingUser, setCheckingUser] = useState(true)
  const [loadingData, setLoadingData] = useState(true)

  const [jadwalList, setJadwalList] = useState<JadwalTanam[]>([])
  const [aktivitasLogs, setAktivitasLogs] = useState<AktivitasLog[]>([])
  const [selectedLahanId, setSelectedLahanId] = useState("semua")
  const [currentMonth, setCurrentMonth] = useState(() => new Date())
  const [selectedItem, setSelectedItem] = useState<KalenderItem | null>(null)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

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

  const fetchKalender = async () => {
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

    if (jadwalError) {
      console.log("FETCH JADWAL KALENDER ERROR:", jadwalError)
      setLoadingData(false)
      return
    }

    const { data: logData, error: logError } = await supabase
      .from("aktivitas_log")
      .select("id, lahan_id, tanggal, jenis_aktivitas")

    if (logError) {
      console.log("FETCH LOG KALENDER ERROR:", logError)
    }

    setJadwalList((jadwalData || []) as unknown as JadwalTanam[])
    setAktivitasLogs((logData || []) as AktivitasLog[])
    setLoadingData(false)
  }

  useEffect(() => {
    if (!checkingUser && user) {
      fetchKalender()
    }
  }, [checkingUser, user])

  const lahanOptions = useMemo(() => {
    const map = new Map<string, Lahan>()

    jadwalList.forEach((jadwal) => {
      if (jadwal.lahan) {
        map.set(jadwal.lahan.id, jadwal.lahan)
      }
    })

    return Array.from(map.values()).sort((a, b) =>
      a.lokasi.localeCompare(b.lokasi)
    )
  }, [jadwalList])

  const kalenderItems = useMemo(() => {
    const items = jadwalList.flatMap((jadwal) =>
      buildKalenderItems(jadwal, aktivitasLogs, today)
    )

    return items.sort((a, b) => {
      if (a.tanggal_mulai === b.tanggal_mulai) {
        return a.lokasi.localeCompare(b.lokasi)
      }

      return a.tanggal_mulai.localeCompare(b.tanggal_mulai)
    })
  }, [jadwalList, aktivitasLogs, today])

  const filteredItems = useMemo(() => {
    return kalenderItems.filter((item) => {
      return selectedLahanId === "semua" || item.lahan_id === selectedLahanId
    })
  }, [kalenderItems, selectedLahanId])

  const calendarDays = useMemo(() => {
    return getCalendarDays(currentMonth)
  }, [currentMonth])

  const itemsByDate = useMemo(() => {
    const map = new Map<string, KalenderItem[]>()

    calendarDays.forEach((day) => {
      const items = filteredItems.filter((item) =>
        isItemOnDate(item, day.dateValue)
      )

      map.set(day.dateValue, items)
    })

    return map
  }, [calendarDays, filteredItems])

  const selectedDateItems = useMemo(() => {
    if (!selectedDate) return []
    return itemsByDate.get(selectedDate) || []
  }, [itemsByDate, selectedDate])

  const monthItems = useMemo(() => {
    const start = toDateInputValue(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1)
    )
    const end = toDateInputValue(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0)
    )

    return filteredItems.filter((item) => {
      return item.tanggal_mulai <= end && item.tanggal_selesai >= start
    })
  }, [filteredItems, currentMonth])

  const todayItems = monthItems.filter(
    (item) => item.status_jadwal === "hari_ini"
  )
  const missedItems = monthItems.filter(
    (item) => item.status_jadwal === "terlewat"
  )
  const completedItems = monthItems.filter(
    (item) => item.status_jadwal === "selesai"
  )

  const goPrevMonth = () => {
    setSelectedDate(null)
    setSelectedItem(null)
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1)
    )
  }

  const goNextMonth = () => {
    setSelectedDate(null)
    setSelectedItem(null)
    setCurrentMonth(
      new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1)
    )
  }

  if (checkingUser) {
    return (
      <main className="min-h-screen bg-gray-50 p-6 text-gray-900">
        Loading...
      </main>
    )
  }

  if (!user) {
    return null
  }

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900">
      <div className="mx-auto w-full max-w-6xl px-4 py-4 md:px-6 md:py-6">
        <header className="mb-6 flex flex-col gap-4 rounded-2xl border bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium text-green-700">RiceShare</p>
            <h1 className="text-2xl font-bold">Kalender Tanam</h1>
            <p className="text-sm text-gray-500">
              Lihat jadwal aktivitas tanam dalam tampilan kalender bulanan.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              onClick={fetchKalender}
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
          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <p className="text-sm text-gray-500">Jadwal Bulan Ini</p>
            <h2 className="mt-2 text-2xl font-bold">{monthItems.length}</h2>
          </div>

          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <p className="text-sm text-gray-500">Hari Ini</p>
            <h2 className="mt-2 text-2xl font-bold">{todayItems.length}</h2>
          </div>

          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <p className="text-sm text-gray-500">Terlewat</p>
            <h2 className="mt-2 text-2xl font-bold">{missedItems.length}</h2>
          </div>

          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <p className="text-sm text-gray-500">Selesai</p>
            <h2 className="mt-2 text-2xl font-bold">{completedItems.length}</h2>
          </div>
        </section>

        <section className="mb-6 rounded-2xl border bg-white p-4 shadow-sm">
          <label className="mb-1 block text-sm font-medium">Filter Lahan</label>

          <div className="relative">
            <select
              value={selectedLahanId}
              onChange={(e) => {
                setSelectedLahanId(e.target.value)
                setSelectedDate(null)
                setSelectedItem(null)
              }}
              className="w-full appearance-none rounded-xl border bg-white px-3 py-2 pr-10 outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="semua">Semua lahan</option>

              {lahanOptions.map((lahan) => (
                <option key={lahan.id} value={lahan.id}>
                  {lahan.lokasi} - {lahan.luas} m²
                </option>
              ))}
            </select>

            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-gray-500">
              ▾
            </span>
          </div>
        </section>

        <section className="rounded-2xl border bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <button
              onClick={goPrevMonth}
              className="rounded-xl border px-3 py-2 text-sm font-medium hover:bg-gray-50"
            >
              ‹
            </button>

            <h2 className="text-lg font-bold capitalize">
              {formatMonthYear(currentMonth)}
            </h2>

            <button
              onClick={goNextMonth}
              className="rounded-xl border px-3 py-2 text-sm font-medium hover:bg-gray-50"
            >
              ›
            </button>
          </div>

          <div className="grid grid-cols-7 border-b pb-2 text-center text-xs font-medium text-gray-500">
            <div>Sen</div>
            <div>Sel</div>
            <div>Rab</div>
            <div>Kam</div>
            <div>Jum</div>
            <div>Sab</div>
            <div>Min</div>
          </div>

          {loadingData ? (
            <div className="py-10 text-center text-sm text-gray-500">
              Memuat kalender tanam...
            </div>
          ) : (
            <div className="grid grid-cols-7">
              {calendarDays.map((day) => {
                const items = itemsByDate.get(day.dateValue) || []
                const isToday = day.dateValue === today
                const isSelected = selectedDate === day.dateValue

                return (
                  <button
                    key={day.dateValue}
                    onClick={() => {
                      setSelectedDate(day.dateValue)
                      setSelectedItem(null)
                    }}
                    className={`min-h-20 border-b border-r p-2 text-left transition hover:bg-green-50 ${
                      !day.isCurrentMonth ? "bg-gray-50 text-gray-400" : ""
                    } ${isSelected ? "bg-green-50" : ""}`}
                  >
                    <div
                      className={`mb-2 flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold ${
                        isToday
                          ? "bg-blue-600 text-white"
                          : day.isCurrentMonth
                          ? "text-gray-900"
                          : "text-gray-400"
                      }`}
                    >
                      {day.dayNumber}
                    </div>

                    <div className="flex flex-wrap gap-1">
                      {items.slice(0, 4).map((item) => (
                        <span
                          key={item.key}
                          title={`${item.label} - ${item.lokasi}`}
                          className={`h-2.5 w-2.5 rounded-full ${item.dotColor}`}
                        />
                      ))}

                      {items.length > 4 && (
                        <span className="text-[10px] text-gray-500">
                          +{items.length - 4}
                        </span>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          )}

          <div className="mt-5 flex flex-wrap gap-4 text-xs text-gray-600">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-purple-500" />
              Mulai / Siap Tanam
            </div>

            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-green-500" />
              Pemupukan / Perawatan
            </div>

            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-yellow-500" />
              Cek Hama
            </div>

            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-red-500" />
              Panen
            </div>

            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-blue-500" />
              Istirahat
            </div>
          </div>
        </section>

        {selectedDate && (
          <section className="mt-6 rounded-2xl border bg-white p-4 shadow-sm">
            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-500">Detail Jadwal</p>
                <h2 className="text-lg font-bold">
                  {formatDateId(selectedDate)}
                </h2>
              </div>

              <button
                onClick={() => {
                  setSelectedDate(null)
                  setSelectedItem(null)
                }}
                className="rounded-xl border px-4 py-2 text-sm font-medium hover:bg-gray-50"
              >
                Tutup
              </button>
            </div>

            {selectedDateItems.length === 0 ? (
              <p className="rounded-xl bg-gray-50 p-4 text-sm text-gray-500">
                Tidak ada jadwal pada tanggal ini.
              </p>
            ) : (
              <div className="space-y-3">
                {selectedDateItems.map((item) => (
                  <article
                    key={item.key}
                    onClick={() => setSelectedItem(item)}
                    className="cursor-pointer rounded-2xl border bg-gray-50 p-4 transition hover:border-green-300 hover:bg-green-50"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="mb-2 flex flex-wrap gap-2">
                          <span
                            className={`rounded-full border px-3 py-1 text-xs font-medium ${item.color}`}
                          >
                            {item.shortLabel}
                          </span>

                          <span
                            className={`rounded-full border px-3 py-1 text-xs font-medium ${getStatusJadwalStyle(
                              item.status_jadwal
                            )}`}
                          >
                            {getStatusJadwalLabel(item.status_jadwal)}
                          </span>
                        </div>

                        <h3 className="font-bold">{item.label}</h3>
                        <p className="text-sm text-gray-500">{item.lokasi}</p>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          router.push(`/lahan/${item.lahan_id}`)
                        }}
                        className="rounded-xl border bg-white px-4 py-2 text-sm font-medium hover:bg-gray-50"
                      >
                        Detail Lahan
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {selectedItem && (
          <section className="mt-6 rounded-2xl border bg-white p-5 shadow-sm">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm text-gray-500">Detail Jadwal</p>
                <h2 className="text-xl font-bold">
                  {selectedItem.label} - {selectedItem.lokasi}
                </h2>
              </div>

              <button
                onClick={() => setSelectedItem(null)}
                className="rounded-xl border px-4 py-2 text-sm font-medium hover:bg-gray-50"
              >
                Tutup Detail
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-xl bg-gray-50 p-4">
                <p className="text-sm text-gray-500">Tanggal</p>
                <p className="font-bold">{selectedItem.tanggal_text}</p>
              </div>

              <div className="rounded-xl bg-gray-50 p-4">
                <p className="text-sm text-gray-500">Jenis Aktivitas</p>
                <p className="font-bold">{selectedItem.label}</p>
              </div>

              <div className="rounded-xl bg-gray-50 p-4 md:col-span-2">
                <p className="mb-1 text-sm text-gray-500">Deskripsi</p>
                <p className="text-sm leading-relaxed text-gray-800">
                  {selectedItem.description}
                </p>
              </div>

              <div className="rounded-xl bg-gray-50 p-4">
                <p className="text-sm text-gray-500">Lahan</p>
                <p className="font-bold">
                  {selectedItem.lokasi} • {selectedItem.luas} m²
                </p>
              </div>

              <div className="rounded-xl bg-gray-50 p-4">
                <p className="text-sm text-gray-500">Status</p>
                <span
                  className={`mt-1 inline-block rounded-full border px-3 py-1 text-xs font-medium ${getStatusJadwalStyle(
                    selectedItem.status_jadwal
                  )}`}
                >
                  {getStatusJadwalLabel(selectedItem.status_jadwal)}
                </span>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <button
                onClick={() => router.push(`/lahan/${selectedItem.lahan_id}`)}
                className="rounded-xl border px-4 py-2 text-sm font-medium hover:bg-gray-50"
              >
                Buka Detail Lahan
              </button>

              {user.role === "pengelola" && (
                <button
                  onClick={() =>
                    router.push(
                      `/lahan/${selectedItem.lahan_id}?open_edit_jadwal=1`
                    )
                  }
                  className="rounded-xl border px-4 py-2 text-sm font-medium hover:bg-gray-50"
                >
                  Ubah Jadwal
                </button>
              )}

              {user.role === "pengelola" &&
                selectedItem.status_jadwal === "hari_ini" && (
                  <button
                    onClick={() =>
                      router.push(
                        `/log/tambah?lahan_id=${
                          selectedItem.lahan_id
                        }&tanggal=${selectedDate || selectedItem.tanggal_mulai}`
                      )
                    }
                    className="rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
                  >
                    Tambah Log Aktivitas
                  </button>
                )}
            </div>
          </section>
        )}
      </div>
    </main>
  )
}