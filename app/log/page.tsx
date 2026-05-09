"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

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

  const resetFilter = () => {
    setSelectedLahanId("semua")
    setSelectedJenis("semua")
    setSelectedTanggal("")
    setSearchKeyword("")
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
        <header className="mb-6 flex flex-col gap-4 rounded-2xl border bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
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
                className="rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
              >
                Tambah Log
              </button>
            )}

            <button
              onClick={fetchData}
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
            <p className="text-sm text-gray-500">Total Log</p>
            <h2 className="mt-2 text-2xl font-bold">{logList.length}</h2>
          </div>

          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <p className="text-sm text-gray-500">Hasil Filter</p>
            <h2 className="mt-2 text-2xl font-bold">{filteredLogs.length}</h2>
          </div>

          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <p className="text-sm text-gray-500">Jenis Aktivitas</p>
            <h2 className="mt-2 text-2xl font-bold">{jenisOptions.length}</h2>
          </div>

          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <p className="text-sm text-gray-500">Lahan Tercatat</p>
            <h2 className="mt-2 text-2xl font-bold">{lahanList.length}</h2>
          </div>
        </section>

        <section className="mb-6 rounded-2xl border bg-white p-4 shadow-sm">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="mb-1 block text-sm font-medium">
                Cari Log
              </label>

              <input
                type="text"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                placeholder="Cari aktivitas, lahan, deskripsi"
                className="w-full rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-green-500"
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
                  className="w-full appearance-none rounded-xl border bg-white px-3 py-2 pr-10 outline-none focus:ring-2 focus:ring-green-500"
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
                  className="w-full appearance-none rounded-xl border bg-white px-3 py-2 pr-10 outline-none focus:ring-2 focus:ring-green-500"
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
                className="w-full rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button
              onClick={resetFilter}
              className="rounded-xl border px-4 py-2 text-sm font-medium hover:bg-gray-50"
            >
              Reset Filter
            </button>
          </div>
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
                className="cursor-pointer rounded-2xl border bg-white p-4 shadow-sm transition hover:border-green-300 hover:bg-green-50"
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
                      className="rounded-xl border px-4 py-2 text-sm font-medium hover:bg-gray-50"
                    >
                      Detail
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        router.push(`/lahan/${log.lahan_id}`)
                      }}
                      className="rounded-xl border px-4 py-2 text-sm font-medium hover:bg-gray-50"
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
    </main>
  )
}