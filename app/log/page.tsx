"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import RiceShareTopNav from "@/components/RiceShareTopNav"
import {
  Plus,
  ClipboardList,
  Filter,
  X,
} from "lucide-react"

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

type AktivitasLog = {
  id: string
  lahan_id: string
  pengelola_id: string | null
  tanggal: string
  jenis_aktivitas: string
  deskripsi: string | null
  bukti: string | null
  created_at: string | null
  lahan?: {
    lokasi: string
    luas: number
    status: string
  } | null
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

function formatStatus(status?: string | null) {
  if (!status) return "Tidak diketahui"

  const label: Record<string, string> = {
    belum_digunakan: "Belum Digunakan",
    masa_tanam_aktif: "Masa Tanam Aktif",
    menjelang_panen: "Menjelang Panen",
    panen_selesai: "Panen Selesai",
    istirahat: "Istirahat",
    siap_tanam_kembali: "Siap Tanam Kembali",
  }

  return label[status] || status
}

function getStatusStyle(status?: string | null) {
  switch (status) {
    case "masa_tanam_aktif":
      return "border-green-200 bg-green-50 text-green-700"
    case "menjelang_panen":
      return "border-yellow-200 bg-yellow-50 text-yellow-700"
    case "panen_selesai":
      return "border-blue-200 bg-blue-50 text-blue-700"
    case "istirahat":
      return "border-gray-200 bg-gray-50 text-gray-700"
    case "siap_tanam_kembali":
      return "border-purple-200 bg-purple-50 text-purple-700"
    case "belum_digunakan":
      return "border-slate-200 bg-slate-50 text-slate-700"
    default:
      return "border-gray-200 bg-gray-50 text-gray-700"
  }
}

export default function LogAktivitasPage() {
  const router = useRouter()

  const [user, setUser] = useState<UserProfile | null>(null)
  const [checkingUser, setCheckingUser] = useState(true)
  const [loadingData, setLoadingData] = useState(true)

  const [logList, setLogList] = useState<AktivitasLog[]>([])
  const [lahanList, setLahanList] = useState<Lahan[]>([])

  const [selectedLahanId, setSelectedLahanId] = useState("semua")
  const [selectedJenis, setSelectedJenis] = useState("semua")
  const [selectedTanggal, setSelectedTanggal] = useState("")
  const [searchKeyword, setSearchKeyword] = useState("")
  const [showFilterPanel, setShowFilterPanel] = useState(false)

  useEffect(() => {
    const savedUser = localStorage.getItem("riceshare_user")

    if (!savedUser) {
      router.push("/")
      return
    }

    setUser(JSON.parse(savedUser))
    setCheckingUser(false)
  }, [router])

  const fetchData = async () => {
    setLoadingData(true)

    const { data: lahanData, error: lahanError } = await supabase
      .from("lahan")
      .select("id, lokasi, luas, status")
      .order("lokasi", { ascending: true })

    if (lahanError) {
      console.log("FETCH LAHAN ERROR:", lahanError)
    }

    const { data: logData, error: logError } = await supabase
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

    if (logError) {
      console.log("FETCH LOG ERROR:", logError)
      setLoadingData(false)
      return
    }

    setLahanList((lahanData || []) as Lahan[])
    setLogList((logData || []) as unknown as AktivitasLog[])
    setLoadingData(false)
  }

  useEffect(() => {
    if (!checkingUser && user) {
      fetchData()
    }
  }, [checkingUser, user])

  const jenisOptions = useMemo(() => {
    const unique = new Set<string>()

    logList.forEach((log) => {
      if (log.jenis_aktivitas) {
        unique.add(log.jenis_aktivitas)
      }
    })

    return Array.from(unique).sort((a, b) => a.localeCompare(b))
  }, [logList])

  const filteredLogs = useMemo(() => {
    return logList.filter((log) => {
      const matchLahan =
        selectedLahanId === "semua" || log.lahan_id === selectedLahanId

      const matchJenis =
        selectedJenis === "semua" || log.jenis_aktivitas === selectedJenis

      const matchTanggal =
        !selectedTanggal || log.tanggal === selectedTanggal

      const keyword = searchKeyword.trim().toLowerCase()

      const matchKeyword =
        !keyword ||
        log.jenis_aktivitas.toLowerCase().includes(keyword) ||
        (log.deskripsi || "").toLowerCase().includes(keyword) ||
        (log.lahan?.lokasi || "").toLowerCase().includes(keyword)

      return matchLahan && matchJenis && matchTanggal && matchKeyword
    })
  }, [
    logList,
    selectedLahanId,
    selectedJenis,
    selectedTanggal,
    searchKeyword,
  ])

  const selectedLahanName = useMemo(() => {
    if (selectedLahanId === "semua") return ""

    return (
      lahanList.find((lahan) => lahan.id === selectedLahanId)?.lokasi || ""
    )
  }, [lahanList, selectedLahanId])

  const activeFilters = useMemo(() => {
    const filters: { key: string; label: string }[] = []

    if (searchKeyword.trim()) {
      filters.push({
        key: "search",
        label: `Cari: ${searchKeyword.trim()}`,
      })
    }

    if (selectedLahanId !== "semua") {
      filters.push({
        key: "lahan",
        label: `Lahan: ${selectedLahanName || "Dipilih"}`,
      })
    }

    if (selectedJenis !== "semua") {
      filters.push({
        key: "jenis",
        label: `Aktivitas: ${selectedJenis}`,
      })
    }

    if (selectedTanggal) {
      filters.push({
        key: "tanggal",
        label: `Tanggal: ${formatDateId(selectedTanggal)}`,
      })
    }

    return filters
  }, [
    searchKeyword,
    selectedLahanId,
    selectedLahanName,
    selectedJenis,
    selectedTanggal,
  ])

  const removeFilter = (key: string) => {
    if (key === "search") {
      setSearchKeyword("")
      return
    }

    if (key === "lahan") {
      setSelectedLahanId("semua")
      return
    }

    if (key === "jenis") {
      setSelectedJenis("semua")
      return
    }

    if (key === "tanggal") {
      setSelectedTanggal("")
    }
  }

  const resetFilter = () => {
    setSelectedLahanId("semua")
    setSelectedJenis("semua")
    setSelectedTanggal("")
    setSearchKeyword("")
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
    <main className="min-h-screen bg-[#f7faf5] text-gray-950">
      <RiceShareTopNav user={user} />
      <div className="pb-28 lg:pb-10">
      <div className="mx-auto max-w-7xl px-4 py-6">
        <header className="mb-6 overflow-hidden rounded-[30px] border border-gray-100 bg-white p-5 shadow-[0_10px_35px_rgba(15,23,42,0.07)] md:flex md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium text-green-700">RiceShare</p>
            <h1 className="text-2xl font-bold">Riwayat Log Aktivitas</h1>
            <p className="text-sm text-gray-500">
              Pantau seluruh catatan aktivitas pengelolaan lahan.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            {isPengelola && (
              <button
              onClick={() => router.push("/log/tambah")}
              className="flex items-center justify-center gap-2 rounded-2xl border border-green-200 bg-white px-5 py-3 text-sm font-semibold text-black shadow-sm transition hover:bg-green-50"
              >
              <Plus size={16} strokeWidth={2.5} />
              Tambah Log
              </button>
            )}


          </div>
        </header>

        <section className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="rounded-3xl border border-green-100 bg-white/80 p-5 shadow-lg">
            <p className="text-sm text-gray-500">Total Log</p>
            <h2 className="mt-2 text-2xl font-bold">{logList.length}</h2>
          </div>

          <div className="rounded-3xl border border-green-100 bg-white/80 p-5 shadow-lg">
            <p className="text-sm text-gray-500">Hasil Filter</p>
            <h2 className="mt-2 text-2xl font-bold">{filteredLogs.length}</h2>
          </div>

          <div className="rounded-3xl border border-green-100 bg-white/80 p-5 shadow-lg">
            <p className="text-sm text-gray-500">Jenis Aktivitas</p>
            <h2 className="mt-2 text-2xl font-bold">{jenisOptions.length}</h2>
          </div>

          <div className="rounded-3xl border border-green-100 bg-white/80 p-5 shadow-lg">
            <p className="text-sm text-gray-500">Lahan Tercatat</p>
            <h2 className="mt-2 text-2xl font-bold">{lahanList.length}</h2>
          </div>
        </section>

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
                  Cari Log
                </label>

                <input
                  type="text"
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  placeholder="Cari aktivitas, lahan, deskripsi"
                  className="w-full rounded-2xl border border-green-200 bg-white px-4 py-3 outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  Filter Lahan
                </label>

                <div className="relative">
                  <select
                    value={selectedLahanId}
                    onChange={(e) => setSelectedLahanId(e.target.value)}
                    className="w-full appearance-none rounded-2xl border border-green-200 bg-white px-3 py-3 pr-10 outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="semua">Semua lahan</option>

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
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  Jenis Aktivitas
                </label>

                <div className="relative">
                  <select
                    value={selectedJenis}
                    onChange={(e) => setSelectedJenis(e.target.value)}
                    className="w-full appearance-none rounded-2xl border border-green-200 bg-white px-3 py-3 pr-10 outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="semua">Semua aktivitas</option>

                    {jenisOptions.map((jenis) => (
                      <option key={jenis} value={jenis}>
                        {jenis}
                      </option>
                    ))}
                  </select>

                  <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-gray-500">
                    ▾
                  </span>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  Tanggal
                </label>

                <input
                  type="date"
                  value={selectedTanggal}
                  onChange={(e) => setSelectedTanggal(e.target.value)}
                  className="w-full rounded-2xl border border-green-200 bg-white px-3 py-3 outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
            </div>
          )}
        </section>

        {loadingData ? (
          <section className="rounded-2xl border bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">Memuat log aktivitas...</p>
          </section>
        ) : filteredLogs.length === 0 ? (
          <section className="rounded-2xl border bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">
              Tidak ada log aktivitas yang sesuai filter.
            </p>
          </section>
        ) : (
          <section className="space-y-3">
            {filteredLogs.map((log) => (
              <article
                key={log.id}
                onClick={() => router.push(`/log/${log.id}`)}
                className="cursor-pointer rounded-2xl border bg-white p-5 shadow-sm transition hover:border-green-300 hover:bg-green-50"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-green-200 bg-green-50 px-3 py-1 text-xs font-medium text-green-700">
                        {log.jenis_aktivitas}
                      </span>

                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-medium ${getStatusStyle(
                          log.lahan?.status
                        )}`}
                      >
                        {formatStatus(log.lahan?.status)}
                      </span>

                      {log.bukti && (
                        <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                          Ada Bukti
                        </span>
                      )}
                    </div>

                    <h2 className="text-lg font-bold">
                      {log.lahan?.lokasi || "Lahan tidak diketahui"}
                    </h2>

                    <p className="text-sm text-gray-500">
                      {formatDateId(log.tanggal)} • Dicatat{" "}
                      {formatDateTimeId(log.created_at)}
                    </p>

                    <p className="mt-3 line-clamp-2 text-sm text-gray-700">
                      {log.deskripsi || "Tidak ada deskripsi."}
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-col gap-2 sm:flex-row md:flex-col">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        router.push(`/log/${log.id}`)
                      }}
                      className="rounded-2xl border border-green-200 bg-white px-4 py-2 text-sm font-medium text-green-700 hover:bg-green-100"
                    >
                      Detail
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        router.push(`/lahan/${log.lahan_id}`)
                      }}
                      className="rounded-2xl border border-green-200 bg-white px-4 py-2 text-sm font-medium text-green-700 hover:bg-green-100"
                    >
                      Lahan
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </section>
        )}
      </div>
      </div>
    </main>
  )
}