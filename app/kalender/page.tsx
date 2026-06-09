"use client"

import { Suspense, useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  MapPin,
  Sprout,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  X,
  Filter,
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
    shortLabel: "Pupuk 1",
    startOffset: 7,
    endOffset: 14,
    color: "bg-lime-100 text-lime-700 border-lime-200",
    dotColor: "bg-lime-500",
    description: "Memberikan pupuk awal untuk mendukung pertumbuhan tanaman.",
  },
  {
    key: "pantau_pertumbuhan_awal",
    label: "Pantau Pertumbuhan Awal",
    shortLabel: "Pantau",
    startOffset: 14,
    endOffset: 21,
    color: "bg-teal-100 text-teal-700 border-teal-200",
    dotColor: "bg-teal-500",
    description: "Pemantauan pertumbuhan awal tanaman padi.",
  },
  {
    key: "persiapan_pengendalian_gulma",
    label: "Pengendalian Gulma",
    shortLabel: "Gulma",
    startOffset: 21,
    endOffset: 35,
    color: "bg-yellow-100 text-yellow-700 border-yellow-200",
    dotColor: "bg-yellow-500",
    description: "Persiapan dan pengendalian gulma di lahan.",
  },
  {
    key: "pemupukan_2",
    label: "Pemupukan 2",
    shortLabel: "Pupuk 2",
    startOffset: 35,
    endOffset: 40,
    color: "bg-lime-100 text-lime-700 border-lime-200",
    dotColor: "bg-lime-500",
    description: "Pemupukan kedua untuk mendukung pertumbuhan.",
  },
  {
    key: "perawatan_lanjutan",
    label: "Perawatan Lanjutan",
    shortLabel: "Rawat",
    startOffset: 40,
    endOffset: 60,
    color: "bg-cyan-100 text-cyan-700 border-cyan-200",
    dotColor: "bg-cyan-500",
    description: "Perawatan dan pemeliharaan lanjutan termasuk pengairan.",
  },
  {
    key: "cek_hama",
    label: "Cek Hama",
    shortLabel: "Hama",
    startOffset: 60,
    endOffset: 69,
    color: "bg-orange-100 text-orange-700 border-orange-200",
    dotColor: "bg-orange-500",
    description: "Memperketat pengawasan terhadap hama dan penyakit.",
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
    description: "Masa jeda untuk mengistirahatkan lahan.",
  },
]

// Alias fleksibel — kata kunci spesifik agar tidak false-match antar aktivitas
const AKTIVITAS_ALIASES: Record<string, string[]> = {
  mulai_tanam:                  ["mulai tanam", "pindah tanam", "awal tanam"],
  cek_adaptasi_bibit:           ["cek adaptasi bibit", "adaptasi bibit", "cek bibit"],
  pemupukan_1:                  ["pemupukan 1", "pemupukan pertama", "pupuk 1", "pupuk pertama"],
  pantau_pertumbuhan_awal:      ["pantau pertumbuhan awal", "pertumbuhan awal", "pantau pertumbuhan"],
  persiapan_pengendalian_gulma: ["pengendalian gulma", "persiapan gulma", "bersihkan gulma", "cabut gulma", "gulma"],
  pemupukan_2:                  ["pemupukan 2", "pemupukan kedua", "pupuk 2", "pupuk kedua"],
  perawatan_lanjutan:           ["perawatan lanjutan", "perawatan", "pemeliharaan", "pengairan"],
  cek_hama:                     ["cek hama", "pengecekan hama", "semprot hama", "pestisida", "penanganan hama", "hama"],
  panen_estimasi:               ["panen estimasi", "panen raya", "panen selesai", "panen"],
  masa_istirahat:               ["masa istirahat", "pengolahan lahan pasca panen", "istirahat lahan"],
}

function aktivitasCocok(jenis: string, templateKey: string, templateLabel: string): boolean {
  const j = jenis.toLowerCase().trim()
  const aliases = AKTIVITAS_ALIASES[templateKey] || [templateLabel.toLowerCase()]
  return aliases.some((alias) => j.includes(alias) || alias.includes(j))
}

function getTodayDateInputValue() {
  const today = new Date()

  return `${today.getFullYear()}-${String(
    today.getMonth() + 1
  ).padStart(2, "0")}-${String(
    today.getDate()
  ).padStart(2, "0")}`
}

function toDateInputValue(date: Date) {
  return `${date.getFullYear()}-${String(
    date.getMonth() + 1
  ).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`
}

function addDays(dateString: string, days: number) {
  const date = new Date(dateString)
  date.setDate(date.getDate() + days)

  return toDateInputValue(date)
}

function formatDateId(dateString?: string | null) {
  if (!dateString) return "-"

  return new Date(dateString).toLocaleDateString(
    "id-ID",
    {
      day: "numeric",
      month: "long",
      year: "numeric",
    }
  )
}

function formatMonthYear(date: Date) {
  return date.toLocaleDateString("id-ID", {
    month: "long",
    year: "numeric",
  })
}

function buildKalenderItems(
  jadwal: JadwalTanam,
  aktivitasLogs: AktivitasLog[],
  today: string
): KalenderItem[] {
  const items: KalenderItem[] = []
  const overrides = jadwal.timeline_overrides || {}

  for (
    let index = 0;
    index < timelineTemplates.length;
    index++
  ) {
    const template = timelineTemplates[index]
    const previousTemplate =
      timelineTemplates[index - 1]
    const previousItem = items[index - 1]

    let startDate = ""
    let endDate = ""

    if (index === 0) {
      startDate = jadwal.tanggal_mulai
      endDate = jadwal.tanggal_mulai
    } else {
      const previousEndOffset =
        previousTemplate?.endOffset || 0

      const gapFromPrevious =
        template.startOffset -
        previousEndOffset

      const duration =
        template.endOffset -
        template.startOffset

      startDate = addDays(
        previousItem.tanggal_selesai,
        gapFromPrevious
      )

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

    const sudahAdaLog = aktivitasLogs.some(
      (log) =>
        log.lahan_id === jadwal.lahan_id &&
        aktivitasCocok(log.jenis_aktivitas, template.key, template.label) &&
        log.tanggal >= startDate &&
        log.tanggal <= endDate
    )

    let statusJadwal:
      | "selesai"
      | "hari_ini"
      | "mendatang"
      | "terlewat" = "mendatang"

    if (sudahAdaLog) {
      statusJadwal = "selesai"
    } else if (
      today >= startDate &&
      today <= endDate
    ) {
      statusJadwal = "hari_ini"
    } else if (today > endDate) {
      statusJadwal = "terlewat"
    }

    items.push({
      key: `${jadwal.id}-${template.key}`,
      label: template.label,
      shortLabel: template.shortLabel,
      description: template.description,
      lahan_id: jadwal.lahan_id,
      jadwal_id: jadwal.id,
      lokasi:
        jadwal.lahan?.lokasi ||
        "Lahan tidak diketahui",
      luas: jadwal.lahan?.luas || 0,
      status_lahan:
        jadwal.lahan?.status || jadwal.status,
      tanggal_mulai: startDate,
      tanggal_selesai: endDate,
      tanggal_text: `${formatDateId(
        startDate
      )} - ${formatDateId(endDate)}`,
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

  const firstDayIndexMonday =
    (firstDay.getDay() + 6) % 7

  const totalDays = lastDay.getDate()

  const days: {
    date: Date
    dateValue: string
    dayNumber: number
    isCurrentMonth: boolean
  }[] = []

  for (
    let i = firstDayIndexMonday;
    i > 0;
    i--
  ) {
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

function isItemOnDate(
  item: KalenderItem,
  dateValue: string
) {
  return (
    dateValue >= item.tanggal_mulai &&
    dateValue <= item.tanggal_selesai
  )
}

function canInputLogFromCalendar(
  item: KalenderItem,
  selectedDate: string,
  today: string,
  user: UserProfile | null
) {
  return (
    user?.role === "pengelola" &&
    item.status_jadwal !== "selesai" &&
    selectedDate <= today &&
    selectedDate >= item.tanggal_mulai &&
    selectedDate <= item.tanggal_selesai
  )
}

function KalenderContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [user, setUser] =
    useState<UserProfile | null>(null)

  const [checkingUser, setCheckingUser] =
    useState(true)

  const [loadingData, setLoadingData] =
    useState(true)

  const [jadwalList, setJadwalList] =
    useState<JadwalTanam[]>([])

  const [aktivitasLogs, setAktivitasLogs] =
    useState<AktivitasLog[]>([])

  const [selectedLahanId, setSelectedLahanId] =
    useState("semua")

  const [showFilterPanel, setShowFilterPanel] =
    useState(false)

  const [currentMonth, setCurrentMonth] =
    useState(() => new Date())

  const [selectedDate, setSelectedDate] =
    useState<string | null>(null)

  const [selectedItem, setSelectedItem] =
    useState<KalenderItem | null>(null)

  const tanggalFromUrl = searchParams.get("tanggal")
  const rangeFromUrl = searchParams.get("range")

  const today = getTodayDateInputValue()

  useEffect(() => {
    const savedUser =
      localStorage.getItem("riceshare_user")

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

    const { data: jadwalData } =
      await supabase
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

    const { data: logData } = await supabase
      .from("aktivitas_log")
      .select("id, lahan_id, tanggal, jenis_aktivitas")
      .order("tanggal", { ascending: false })

    setJadwalList(
      (jadwalData || []) as unknown as JadwalTanam[]
    )

    setAktivitasLogs(
      (logData || []) as AktivitasLog[]
    )

    setLoadingData(false)
  }

  useEffect(() => {
    if (!checkingUser && user) {
      fetchKalender()
    }
  }, [checkingUser, user])

  useEffect(() => {
    if (!tanggalFromUrl) return

    setSelectedDate(tanggalFromUrl)
    setCurrentMonth(new Date(`${tanggalFromUrl}T00:00:00`))
  }, [tanggalFromUrl])

  const kalenderItems = useMemo(() => {
    return jadwalList.flatMap((jadwal) =>
      buildKalenderItems(
        jadwal,
        aktivitasLogs,
        today
      )
    )
  }, [jadwalList, aktivitasLogs, today])

  const filteredItems = useMemo(() => {
    return kalenderItems.filter((item) => {
      return (
        selectedLahanId === "semua" ||
        item.lahan_id === selectedLahanId
      )
    })
  }, [kalenderItems, selectedLahanId])

  const selectedLahanName = useMemo(() => {
    if (selectedLahanId === "semua") return ""

    return (
      jadwalList.find((jadwal) => jadwal.lahan_id === selectedLahanId)
        ?.lahan?.lokasi || ""
    )
  }, [jadwalList, selectedLahanId])

  const activeFilters = useMemo(() => {
    const filters: { key: string; label: string }[] = []

    if (selectedLahanId !== "semua") {
      filters.push({
        key: "lahan",
        label: `Lahan: ${selectedLahanName || "Dipilih"}`,
      })
    }

    return filters
  }, [selectedLahanId, selectedLahanName])

  const removeFilter = (key: string) => {
    if (key === "lahan") {
      setSelectedLahanId("semua")
    }
  }

  const resetFilter = () => {
    setSelectedLahanId("semua")
  }

  const calendarDays = useMemo(() => {
    return getCalendarDays(currentMonth)
  }, [currentMonth])

  const itemsByDate = useMemo(() => {
    const map = new Map<
      string,
      KalenderItem[]
    >()

    calendarDays.forEach((day) => {
      const items = filteredItems.filter((item) =>
        isItemOnDate(item, day.dateValue)
      )

      map.set(day.dateValue, items)
    })

    return map
  }, [calendarDays, filteredItems])

  const displayedMonthStart = toDateInputValue(
    new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth(),
      1
    )
  )

  const displayedMonthEnd = toDateInputValue(
    new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth() + 1,
      0
    )
  )

  const monthItems = filteredItems.filter((item) => {
    return (
      item.tanggal_mulai <= displayedMonthEnd &&
      item.tanggal_selesai >= displayedMonthStart
    )
  })

  const totalAktivitasBulanIni = new Set(
    monthItems.map((item) =>
      [
        item.lahan_id,
        item.jadwal_id,
        item.key,
      ].join("-")
    )
  ).size

  const todayItems = monthItems.filter(
    (item) => item.status_jadwal === "hari_ini"
  )

  const missedItems = monthItems.filter(
    (item) => item.status_jadwal === "terlewat"
  )

  const completedItems = monthItems.filter(
    (item) => item.status_jadwal === "selesai"
  )

  if (checkingUser) {
    return (
      <main className="min-h-screen bg-gray-50 p-6">
        Loading...
      </main>
    )
  }

  if (!user) return null

  return (
    <main className="min-h-screen bg-[#f7faf5] text-gray-950">
      <RiceShareTopNav user={user} />

      <div className="pb-28 lg:pb-10">
      <div className="mx-auto max-w-7xl px-4 py-6">

        {/* HEADER */}
        <header className="mb-6 overflow-hidden rounded-[30px] border border-gray-100 bg-white p-5 shadow-[0_10px_35px_rgba(15,23,42,0.07)] md:flex md:items-center md:justify-between">
          <div>
              <p className="text-sm font-medium text-green-700">
                RiceShare
              </p>

              <h1 className="text-2xl font-bold">
                Kalender Tanam
              </h1>

              <p className="text-sm text-gray-500">
                Pantau seluruh jadwal aktivitas
                pertanian dalam tampilan kalender.
              </p>
            </div>
        </header>

        {/* STATS */}
        <section className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">

          <div className="rounded-3xl border border-green-100 bg-white/80 p-5 shadow-lg">
            <p className="text-sm text-gray-500">
              Total Aktivitas Bulan Ini
            </p>

            <h2 className="mt-2 text-2xl font-bold">
              {totalAktivitasBulanIni}
            </h2>
          </div>

          <div className="rounded-3xl border border-green-100 bg-white/80 p-5 shadow-lg">
            <p className="text-sm text-gray-500">
              Hari Ini
            </p>

            <h2 className="mt-2 text-2xl font-bold">
              {todayItems.length}
            </h2>
          </div>

          <div className="rounded-3xl border border-green-100 bg-white/80 p-5 shadow-lg">
            <p className="text-sm text-gray-500">
              Terlewat
            </p>

            <h2 className="mt-2 text-2xl font-bold">
              {missedItems.length}
            </h2>
          </div>

          <div className="rounded-3xl border border-green-100 bg-white/80 p-5 shadow-lg">
            <p className="text-sm text-gray-500">
              Selesai
            </p>

            <h2 className="mt-2 text-2xl font-bold">
              {completedItems.length}
            </h2>
          </div>
        </section>

        {/* FILTER */}
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
                <p className="text-sm font-medium text-gray-500">
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
                  Filter Lahan
                </label>

                <select
                  value={selectedLahanId}
                  onChange={(e) =>
                    setSelectedLahanId(
                      e.target.value
                    )
                  }
                  className="w-full rounded-2xl border border-green-200 bg-white px-4 py-3 outline-none transition focus:ring-2 focus:ring-green-500"
                >
                  <option value="semua">
                    Semua Lahan
                  </option>

                  {jadwalList.map((jadwal) => (
                    <option
                      key={jadwal.id}
                      value={jadwal.lahan_id}
                    >
                      {jadwal.lahan?.lokasi}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </section>

        {/* CALENDAR */}
        <section className="rounded-[28px] border border-green-100 bg-white/80 p-5 shadow-xl">

          <div className="mb-6 flex items-center justify-between">

            <button
              onClick={() =>
                setCurrentMonth(
                  new Date(
                    currentMonth.getFullYear(),
                    currentMonth.getMonth() - 1,
                    1
                  )
                )
              }
              className="flex h-12 w-12 items-center justify-center rounded-2xl border border-green-200 bg-white transition hover:bg-green-50"
            >
              <ChevronLeft size={20} />
            </button>

            <div className="text-center">
              <p className="text-sm text-gray-500">
                Kalender Aktivitas
              </p>

              <h2 className="text-2xl font-bold capitalize">
                {formatMonthYear(currentMonth)}
              </h2>
            </div>

            <button
              onClick={() =>
                setCurrentMonth(
                  new Date(
                    currentMonth.getFullYear(),
                    currentMonth.getMonth() + 1,
                    1
                  )
                )
              }
              className="flex h-12 w-12 items-center justify-center rounded-2xl border border-green-200 bg-white transition hover:bg-green-50"
            >
              <ChevronRight size={20} />
            </button>
          </div>

          <div className="overflow-x-auto">

            <div className="min-w-[900px]">

              <div className="mb-3 grid grid-cols-7 gap-3 text-center">
                {[
                  "Sen",
                  "Sel",
                  "Rab",
                  "Kam",
                  "Jum",
                  "Sab",
                  "Min",
                ].map((day) => (
                  <div
                    key={day}
                    className="font-semibold text-gray-500"
                  >
                    {day}
                  </div>
                ))}
              </div>

              {loadingData ? (
                <div className="py-16 text-center text-gray-500">
                  Memuat kalender...
                </div>
              ) : (
                <div className="grid grid-cols-7 gap-3">

                  {calendarDays.map((day) => {
                    const items =
                      itemsByDate.get(
                        day.dateValue
                      ) || []

                    const isToday =
                      day.dateValue === today

                    return (
                      <button
                        key={day.dateValue}
                        onClick={() =>
                          setSelectedDate(
                            day.dateValue
                          )
                        }
                        className={`min-h-[130px] rounded-3xl border p-3 text-left transition-all hover:scale-[1.01]
                        
                        ${
                          !day.isCurrentMonth
                            ? "border-gray-100 bg-gray-100/70 text-gray-400"
                            : "border-green-100 bg-green-50"
                        }

                        ${
                          isToday
                            ? "ring-2 ring-green-500"
                            : ""
                        }
                        `}
                      >
                        <div
                          className={`mb-3 flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold
                          
                          ${
                            isToday
                              ? "bg-gradient-to-r from-green-500 to-emerald-600 text-white"
                              : "bg-white text-gray-700"
                          }
                          `}
                        >
                          {day.dayNumber}
                        </div>

                        <div className="space-y-1">
                          {items
                            .slice(0, 3)
                            .map((item) => (
                              <div
                                key={item.key}
                                className={`truncate rounded-xl border px-2 py-1 text-[11px] font-semibold ${item.color}`}
                              >
                                {
                                  item.shortLabel
                                }
                              </div>
                            ))}

                          {items.length > 3 && (
                            <div className="text-[11px] font-semibold text-gray-500">
                              +
                              {items.length -
                                3}{" "}
                              lainnya
                            </div>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* LEGEND */}
          <div className="mt-6 flex flex-wrap gap-4">

            <div className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm shadow">
              <span className="h-3 w-3 rounded-full bg-purple-500" />
              Mulai Tanam
            </div>

            <div className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm shadow">
              <span className="h-3 w-3 rounded-full bg-green-500" />
              Perawatan
            </div>

            <div className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm shadow">
              <span className="h-3 w-3 rounded-full bg-yellow-500" />
              Hama
            </div>

            <div className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm shadow">
              <span className="h-3 w-3 rounded-full bg-red-500" />
              Panen
            </div>

            <div className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm shadow">
              <span className="h-3 w-3 rounded-full bg-blue-500" />
              Istirahat
            </div>
          </div>
        </section>

        {/* DETAIL */}
        {selectedDate && (
          <section className="mt-6 rounded-[30px] border border-green-100 bg-white/80 p-5 shadow-2xl">

            <div className="mb-5 flex items-center justify-between">

              <div>
                <p className="text-sm text-gray-500">
                  Jadwal Tanggal
                </p>

                <h2 className="text-2xl font-bold">
                  {formatDateId(selectedDate)}
                </h2>
              </div>

              <button
                onClick={() => {
                  setSelectedDate(null)
                  setSelectedItem(null)
                }}
                className="flex h-11 w-11 items-center justify-center rounded-2xl border border-red-200 bg-red-50 text-red-600"
              >
                <X size={18} />
              </button>
            </div>

            {(itemsByDate.get(selectedDate) || [])
              .length === 0 ? (
              <div className="rounded-3xl bg-gray-50 p-8 text-center text-gray-500">
                Tidak ada aktivitas pada tanggal
                ini.
              </div>
            ) : (
              <div className="space-y-4">

                {(itemsByDate.get(
                  selectedDate
                ) || []).map((item) => (
                  <div
                    key={item.key}
                    onClick={() =>
                      setSelectedItem(item)
                    }
                    className="cursor-pointer rounded-3xl border border-green-100 bg-gradient-to-r from-white to-green-50 p-5 shadow-sm transition hover:scale-[1.01]"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

                      <div>

                        <div className="mb-3 flex flex-wrap gap-2">

                          <span
                            className={`rounded-full border px-3 py-1 text-xs font-semibold ${item.color}`}
                          >
                            {item.shortLabel}
                          </span>

                          <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
                            {item.lokasi}
                          </span>
                        </div>

                        <h3 className="text-lg font-bold">
                          {item.label}
                        </h3>

                        <p className="mt-1 text-sm text-gray-500">
                          {
                            item.tanggal_text
                          }
                        </p>
                      </div>

                      <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
                        {canInputLogFromCalendar(item, selectedDate, today, user) && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()

                              router.push(
                                `/log/tambah?lahan_id=${item.lahan_id}&tanggal=${selectedDate}`
                              )
                            }}
                            className="rounded-2xl bg-gradient-to-r from-green-500 to-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-lg"
                          >
                            Input Log
                          </button>
                        )}

                        <button
                          onClick={(e) => {
                            e.stopPropagation()

                            router.push(
                              `/lahan/${item.lahan_id}`
                            )
                          }}
                          className="rounded-2xl border border-green-200 bg-white px-5 py-3 text-sm font-semibold text-green-700 shadow-sm transition hover:bg-green-50"
                        >
                          Detail Lahan
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* MODAL DETAIL */}
        {selectedItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">

            <div className="w-full max-w-2xl rounded-[32px] bg-white p-6 shadow-2xl">

              <div className="mb-5 flex items-start justify-between">

                <div>
                  <p className="text-sm text-green-700">
                    Detail Aktivitas
                  </p>

                  <h2 className="mt-1 text-2xl font-bold">
                    {selectedItem.label}
                  </h2>
                </div>

                <button
                  onClick={() =>
                    setSelectedItem(null)
                  }
                  className="flex h-11 w-11 items-center justify-center rounded-2xl bg-red-50 text-red-600"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">

                <div className="rounded-3xl bg-green-50 p-4">
                  <div className="mb-2 flex items-center gap-2 text-green-700">
                    <CalendarDays size={18} />
                    <p className="font-semibold">
                      Jadwal
                    </p>
                  </div>

                  <p className="text-sm text-gray-700">
                    {
                      selectedItem.tanggal_text
                    }
                  </p>
                </div>

                <div className="rounded-3xl bg-blue-50 p-4">
                  <div className="mb-2 flex items-center gap-2 text-blue-700">
                    <MapPin size={18} />
                    <p className="font-semibold">
                      Lokasi
                    </p>
                  </div>

                  <p className="text-sm text-gray-700">
                    {selectedItem.lokasi}
                  </p>
                </div>

                <div className="rounded-3xl bg-yellow-50 p-4 md:col-span-2">
                  <div className="mb-2 flex items-center gap-2 text-yellow-700">
                    <Sprout size={18} />
                    <p className="font-semibold">
                      Deskripsi
                    </p>
                  </div>

                  <p className="text-sm leading-relaxed text-gray-700">
                    {
                      selectedItem.description
                    }
                  </p>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap gap-3">

                <button
                  onClick={() =>
                    router.push(
                      `/lahan/${selectedItem.lahan_id}`
                    )
                  }
                  className="rounded-2xl border border-green-200 bg-green-50 px-5 py-3 text-sm font-semibold text-green-700"
                >
                  Buka Detail Lahan
                </button>

                {user.role ===
                  "pengelola" && (
                  <button
                    onClick={() =>
                      router.push(
                        `/log/tambah?lahan_id=${selectedItem.lahan_id}`
                      )
                    }
                    className="rounded-2xl bg-gradient-to-r from-green-500 to-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-lg"
                  >
                    Tambah Aktivitas
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
      </div>
    </main>
  )
}

export default function KalenderPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#f7faf5] p-6 text-gray-950">
          <div className="rounded-3xl bg-white px-8 py-6 shadow-xl">
            <p className="text-lg font-semibold text-green-700">
              Memuat kalender...
            </p>
          </div>
        </main>
      }
    >
      <KalenderContent />
    </Suspense>
  )
}
