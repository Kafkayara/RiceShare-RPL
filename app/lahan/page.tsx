"use client"

import { syncLahanStatus } from "@/lib/syncLahanStatus"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import {
  Map,
  Sprout,
  Wheat,
  Eye,
  ClipboardList,
  ArrowLeft,
  RefreshCw,
} from "lucide-react"

type UserProfile = {
  id: string
  nama: string
  email: string
  role: "pemilik" | "pengelola"
}

type JadwalTanam = {
  id: string
  tanggal_mulai: string
  tanggal_selesai: string
  status: string
  varietas_padi?: string | null
  jumlah_benih?: number | null
}

type LahanItem = {
  id: string
  lokasi: string
  luas: number
  status: string
  jadwal_tanam?: JadwalTanam[]
}

function formatDateId(dateString?: string | null) {
  if (!dateString) return "-"

  return new Date(dateString).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
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
      return "bg-green-100 text-green-700 border border-green-200"

    case "menjelang_panen":
      return "bg-yellow-100 text-yellow-700 border border-yellow-200"

    case "panen_selesai":
      return "bg-blue-100 text-blue-700 border border-blue-200"

    case "istirahat":
      return "bg-gray-100 text-gray-700 border border-gray-200"

    case "siap_tanam_kembali":
      return "bg-emerald-100 text-emerald-700 border border-emerald-200"

    case "belum_digunakan":
      return "bg-slate-100 text-slate-700 border border-slate-200"

    default:
      return "bg-gray-100 text-gray-700 border border-gray-200"
  }
}

function addDays(dateString: string, days: number) {
  const date = new Date(dateString)

  date.setDate(date.getDate() + days)

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")

  return `${year}-${month}-${day}`
}

export default function LahanPage() {
  const router = useRouter()

  const [user, setUser] = useState<UserProfile | null>(null)
  const [checkingUser, setCheckingUser] = useState(true)

  const [lahanList, setLahanList] = useState<LahanItem[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchLahan = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true)
    } else {
      setLoadingData(true)
    }

    await syncLahanStatus()

    const { data, error } = await supabase
      .from("lahan")
      .select(`
        id,
        lokasi,
        luas,
        status,
        jadwal_tanam (
          id,
          tanggal_mulai,
          tanggal_selesai,
          status,
          varietas_padi,
          jumlah_benih
        )
      `)
      .order("lokasi", { ascending: true })

    if (error) {
      console.log("FETCH LAHAN ERROR:", error)
      setLoadingData(false)
      setRefreshing(false)
      return
    }

    setLahanList(data || [])
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
    fetchLahan()
  }, [])

  if (checkingUser) {
    return (
      <main className="min-h-screen bg-[#f4f7f1] p-6 text-gray-900">
        Loading...
      </main>
    )
  }

  if (!user) {
    return null
  }

  const isPengelola = user.role === "pengelola"

  return (
    <main className="min-h-screen bg-gradient-to-br from-green-50 via-lime-50 to-emerald-100 text-gray-900">
      <div className="mx-auto w-full max-w-7xl px-4 py-5 md:px-6 md:py-6">

        {/* HEADER */}
        <header className="relative mb-7 overflow-hidden rounded-[32px] border border-white/60 bg-white/75 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur-2xl">

          <div className="absolute inset-0 bg-gradient-to-r from-green-100/40 via-transparent to-emerald-100/40" />

          <div className="relative flex flex-col gap-6 p-6 md:flex-row md:items-center md:justify-between md:p-8">

            <div className="min-w-0">

              <div className="mb-4 flex items-center gap-4">

                <div className="flex h-16 w-16 items-center justify-center rounded-[24px] bg-gradient-to-br from-green-500 to-emerald-600 text-white shadow-xl shadow-green-200">
                  <Map size={30} />
                </div>

                <div>
                  <p className="text-sm font-bold tracking-[0.2em] text-green-700 uppercase">
                    RiceShare
                  </p>

                  <h1 className="mt-1 text-3xl font-black tracking-tight md:text-4xl">
                    Status Lahan
                  </h1>
                </div>
              </div>

              <p className="max-w-2xl text-sm leading-relaxed text-gray-500 md:text-base">
                Pantau kondisi lahan pertanian, masa tanam aktif,
                estimasi panen, serta perkembangan aktivitas terbaru
                secara real-time.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">

              

              <button
                onClick={() => router.push("/dashboard")}
                className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-green-500 to-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-green-200 transition-all hover:scale-[1.02]"
              >
                Dashboard
              </button>
            </div>
          </div>
        </header>

        {/* SUMMARY */}
        {!loadingData && lahanList.length > 0 && (
          <section className="mb-7 grid grid-cols-2 gap-4 xl:grid-cols-4">

            <div className="rounded-[30px] border border-white/60 bg-white/80 p-5 shadow-[0_16px_40px_rgba(15,23,42,0.06)] backdrop-blur-2xl">

              <div className="flex items-center justify-between">

                <div>
                  <p className="text-sm font-medium text-gray-500">
                    Total Lahan
                  </p>

                  <h2 className="mt-2 text-4xl font-black text-green-700">
                    {lahanList.length}
                  </h2>
                </div>

                <div className="flex h-16 w-16 items-center justify-center rounded-[24px] bg-green-100 text-green-700">
                  <Map size={30} />
                </div>
              </div>
            </div>

            <div className="rounded-[30px] border border-white/60 bg-white/80 p-5 shadow-[0_16px_40px_rgba(15,23,42,0.06)] backdrop-blur-2xl">

              <div className="flex items-center justify-between">

                <div>
                  <p className="text-sm font-medium text-gray-500">
                    Menjelang Panen
                  </p>

                  <h2 className="mt-2 text-4xl font-black text-yellow-600">
                    {
                      lahanList.filter(
                        (x) => x.status === "menjelang_panen"
                      ).length
                    }
                  </h2>
                </div>

                <div className="flex h-16 w-16 items-center justify-center rounded-[24px] bg-yellow-100 text-yellow-700">
                  <Wheat size={30} />
                </div>
              </div>
            </div>

            <div className="rounded-[30px] border border-white/60 bg-white/80 p-5 shadow-[0_16px_40px_rgba(15,23,42,0.06)] backdrop-blur-2xl">

              <div className="flex items-center justify-between">

                <div>
                  <p className="text-sm font-medium text-gray-500">
                    Masa Tanam
                  </p>

                  <h2 className="mt-2 text-4xl font-black text-blue-700">
                    {
                      lahanList.filter(
                        (x) => x.status === "masa_tanam_aktif"
                      ).length
                    }
                  </h2>
                </div>

                <div className="flex h-16 w-16 items-center justify-center rounded-[24px] bg-blue-100 text-blue-700">
                  <Sprout size={30} />
                </div>
              </div>
            </div>

            <div className="rounded-[30px] border border-white/60 bg-white/80 p-5 shadow-[0_16px_40px_rgba(15,23,42,0.06)] backdrop-blur-2xl">

              <div className="flex items-center justify-between">

                <div>
                  <p className="text-sm font-medium text-gray-500">
                    Siap Tanam
                  </p>

                  <h2 className="mt-2 text-4xl font-black text-emerald-700">
                    {
                      lahanList.filter(
                        (x) => x.status === "siap_tanam_kembali"
                      ).length
                    }
                  </h2>
                </div>

                <div className="flex h-16 w-16 items-center justify-center rounded-[24px] bg-emerald-100 text-emerald-700">
                  🌱
                </div>
              </div>
            </div>
          </section>
        )}

        {/* LOADING */}
        {loadingData ? (
          <section className="rounded-[32px] border border-white/60 bg-white/80 p-8 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur-2xl">

            <div className="flex items-center gap-4">

              <div className="h-14 w-14 animate-pulse rounded-[22px] bg-green-100" />

              <div className="space-y-3">
                <div className="h-4 w-52 animate-pulse rounded-full bg-gray-200" />
                <div className="h-4 w-36 animate-pulse rounded-full bg-gray-100" />
              </div>
            </div>

            <p className="mt-6 text-sm text-gray-500">
              Memuat data lahan...
            </p>
          </section>
        ) : lahanList.length === 0 ? (
          <section className="rounded-[32px] border border-white/60 bg-white/80 p-10 text-center shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur-2xl">

            <div className="mx-auto mb-5 flex h-24 w-24 items-center justify-center rounded-full bg-green-100 text-4xl">
              🌾
            </div>

            <h2 className="text-2xl font-bold">
              Belum Ada Data Lahan
            </h2>

            <p className="mt-3 text-sm text-gray-500">
              Data lahan pertanian belum tersedia saat ini.
            </p>
          </section>
        ) : (
          <section className="grid grid-cols-1 gap-5 xl:grid-cols-2">

            {lahanList.map((lahan) => {
              const jadwalTerbaru = lahan.jadwal_tanam?.[0]

              const estimasiPanenMulai = jadwalTerbaru?.tanggal_mulai
                ? addDays(jadwalTerbaru.tanggal_mulai, 80)
                : null

              const estimasiPanenSelesai =
                jadwalTerbaru?.tanggal_selesai

              return (
                <article
                  key={lahan.id}
                  className="group overflow-hidden rounded-[32px] border border-white/60 bg-white/80 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur-2xl transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_28px_80px_rgba(15,23,42,0.12)]"
                >

                  {/* TOP */}
                  <div className="relative overflow-hidden bg-gradient-to-r from-green-500 via-emerald-500 to-green-600 p-6 text-white">

                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.25),transparent_40%)]" />

                    <div className="relative flex items-start justify-between gap-4">

                      <div className="min-w-0">

                        <div className="mb-3 flex items-center gap-3">

                          <div className="flex h-12 w-12 items-center justify-center rounded-[20px] bg-white/20 backdrop-blur-xl">
                            🌾
                          </div>

                          <div>
                            <h2 className="truncate text-2xl font-bold">
                              Lahan {lahan.lokasi}
                            </h2>

                            <p className="text-sm text-green-100">
                              Luas {lahan.luas} m²
                            </p>
                          </div>
                        </div>
                      </div>

                      <span
                        className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold backdrop-blur-xl ${getStatusStyle(
                          lahan.status
                        )}`}
                      >
                        {formatStatus(lahan.status)}
                      </span>
                    </div>
                  </div>

                  {/* BODY */}
                  <div className="space-y-4 p-6">

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">

                      <div className="rounded-[24px] border border-green-100 bg-green-50/70 p-4">

                        <p className="text-sm font-medium text-gray-500">
                          Tanggal Pindah Tanam
                        </p>

                        <p className="mt-2 text-base font-bold text-gray-800">
                          {formatDateId(
                            jadwalTerbaru?.tanggal_mulai
                          )}
                        </p>
                      </div>

                      <div className="rounded-[24px] border border-yellow-100 bg-yellow-50/70 p-4">

                        <p className="text-sm font-medium text-gray-500">
                          Estimasi Panen
                        </p>

                        <p className="mt-2 text-base font-bold leading-relaxed text-gray-800">
                          {estimasiPanenMulai &&
                          estimasiPanenSelesai
                            ? `${formatDateId(
                                estimasiPanenMulai
                              )} – ${formatDateId(
                                estimasiPanenSelesai
                              )}`
                            : "-"}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

                      <div className="rounded-[24px] border border-blue-100 bg-blue-50/70 p-4">

                        <p className="text-sm font-medium text-gray-500">
                          Varietas Padi
                        </p>

                        <p className="mt-2 font-bold text-gray-800">
                          {jadwalTerbaru?.varietas_padi || "-"}
                        </p>
                      </div>

                      <div className="rounded-[24px] border border-emerald-100 bg-emerald-50/70 p-4">

                        <p className="text-sm font-medium text-gray-500">
                          Jumlah Benih
                        </p>

                        <p className="mt-2 font-bold text-gray-800">
                          {jadwalTerbaru?.jumlah_benih
                            ? `${jadwalTerbaru.jumlah_benih} kg`
                            : "-"}
                        </p>
                      </div>
                    </div>

                    {/* BUTTON */}
                    <div className="flex flex-col gap-3 pt-2 sm:flex-row">

                      <button
                        onClick={() =>
                          router.push(`/lahan/${lahan.id}`)
                        }
                        className={`flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-green-500 to-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-green-200 transition-all hover:scale-[1.02] ${
                          isPengelola
                            ? "w-full sm:w-1/2"
                            : "w-full"
                        }`}
                      >
                        <Eye size={18} />
                        Lihat Detail
                      </button>

                      {isPengelola && (
                        <button
                          onClick={() =>
                            router.push(
                              `/log/tambah?lahan_id=${lahan.id}`
                            )
                          }
                          className="flex items-center justify-center gap-2 rounded-2xl border border-green-100 bg-white px-5 py-3 text-sm font-bold text-gray-700 transition-all hover:bg-green-50"
                        >
                          <ClipboardList size={18} />
                          Log Aktivitas
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              )
            })}
          </section>
        )}
      </div>
    </main>
  )
}