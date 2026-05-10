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

type BagiHasil = {
  id?: string
  panen_id?: string
  total_beras: number | null
  porsi_pemilik: number | null
  porsi_pengelola: number | null
}

type PanenRecord = {
  id: string
  lahan_id: string
  pengelola_id: string | null
  berat_gkp: number
  tanggal: string
  catatan: string | null
  bukti_url: string | null
  created_at: string | null
  lahan?: Lahan | null
  bagi_hasil?: BagiHasil[] | null
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

function getBagiHasil(panen: PanenRecord) {
  return panen.bagi_hasil?.[0] || null
}

export default function RiwayatPanenPage() {
  const router = useRouter()

  const [user, setUser] = useState<UserProfile | null>(null)
  const [checkingUser, setCheckingUser] = useState(true)
  const [loadingData, setLoadingData] = useState(true)

  const [panenList, setPanenList] = useState<PanenRecord[]>([])
  const [lahanList, setLahanList] = useState<Lahan[]>([])
  const [selectedPanen, setSelectedPanen] = useState<PanenRecord | null>(null)

  const [selectedLahanId, setSelectedLahanId] = useState("semua")
  const [tanggalMulai, setTanggalMulai] = useState("")
  const [tanggalAkhir, setTanggalAkhir] = useState("")
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

    const { data: lahanData } = await supabase
      .from("lahan")
      .select("id, lokasi, luas, status")
      .order("lokasi", { ascending: true })

    const { data: panenData, error: panenError } = await supabase
      .from("panen")
      .select(`
        id,
        lahan_id,
        pengelola_id,
        berat_gkp,
        tanggal,
        catatan,
        bukti_url,
        created_at,
        lahan (
          id,
          lokasi,
          luas,
          status
        ),
        bagi_hasil (
          total_beras,
          porsi_pemilik,
          porsi_pengelola
        )
      `)
      .order("tanggal", { ascending: false })
      .order("created_at", { ascending: false })

    if (panenError) {
      console.log("FETCH RIWAYAT PANEN ERROR:", panenError)
      setLoadingData(false)
      return
    }

    setLahanList((lahanData || []) as Lahan[])
    setPanenList((panenData || []) as unknown as PanenRecord[])
    setLoadingData(false)
  }

  useEffect(() => {
    if (!checkingUser && user) {
      fetchData()
    }
  }, [checkingUser, user])

  const filteredPanen = useMemo(() => {
    return panenList.filter((panen) => {
      const matchLahan =
        selectedLahanId === "semua" ||
        panen.lahan_id === selectedLahanId

      const matchTanggalMulai =
        !tanggalMulai || panen.tanggal >= tanggalMulai

      const matchTanggalAkhir =
        !tanggalAkhir || panen.tanggal <= tanggalAkhir

      const keyword = searchKeyword.trim().toLowerCase()

      const matchKeyword =
        !keyword ||
        (panen.lahan?.lokasi || "")
          .toLowerCase()
          .includes(keyword) ||
        (panen.catatan || "")
          .toLowerCase()
          .includes(keyword)

      return (
        matchLahan &&
        matchTanggalMulai &&
        matchTanggalAkhir &&
        matchKeyword
      )
    })
  }, [
    panenList,
    selectedLahanId,
    tanggalMulai,
    tanggalAkhir,
    searchKeyword,
  ])

  const summary = useMemo(() => {
    return filteredPanen.reduce(
      (acc, panen) => {
        const bagiHasil = getBagiHasil(panen)

        acc.totalPanen += 1
        acc.totalGkp += Number(panen.berat_gkp || 0)
        acc.totalBeras += Number(bagiHasil?.total_beras || 0)
        acc.totalPemilik += Number(
          bagiHasil?.porsi_pemilik || 0
        )
        acc.totalPengelola += Number(
          bagiHasil?.porsi_pengelola || 0
        )

        return acc
      },
      {
        totalPanen: 0,
        totalGkp: 0,
        totalBeras: 0,
        totalPemilik: 0,
        totalPengelola: 0,
      }
    )
  }, [filteredPanen])

  const resetFilter = () => {
    setSelectedLahanId("semua")
    setTanggalMulai("")
    setTanggalAkhir("")
    setSearchKeyword("")
  }

  if (checkingUser) {
    return (
      <main className="min-h-screen bg-gray-50 p-6">
        Loading...
      </main>
    )
  }

  if (!user) return null

  const isPemilik = user.role === "pemilik"
  const isPengelola = user.role === "pengelola"

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900">

      <div className="mx-auto w-full max-w-6xl px-4 py-6">

        {/* HEADER */}
        <header className="mb-6 flex flex-col gap-4 rounded-2xl border bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between">

          <div>

            <p className="text-sm font-medium text-green-700">
              RiceShare
            </p>

            <div className="mt-1 flex items-center gap-3">

              <h1 className="text-3xl font-bold">
                🌾 Riwayat Panen
              </h1>

              {isPemilik && (
                <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
                  👨‍🌾 Pemilik
                </span>
              )}

              {isPengelola && (
                <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                  🧑‍🌾 Pengelola
                </span>
              )}

            </div>

            <p className="mt-2 text-sm text-gray-500">
              Pantau seluruh hasil panen dan pembagian hasil.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">

            {isPengelola && (
              <button
                onClick={() => router.push("/panen")}
                className="rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
              >
                + Input Panen
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

        {/* MODE INFO */}
        <section className="mb-6">

          {isPemilik && (
            <div className="rounded-2xl border border-green-200 bg-green-50 p-4">
              <p className="font-semibold text-green-700">
                👨‍🌾 Mode Pemilik
              </p>

              <p className="mt-1 text-sm text-green-600">
                Pemilik hanya dapat memonitor hasil panen dan pembagian hasil.
              </p>
            </div>
          )}

          {isPengelola && (
            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
              <p className="font-semibold text-blue-700">
                🧑‍🌾 Mode Pengelola
              </p>

              <p className="mt-1 text-sm text-blue-600">
                Pengelola dapat melakukan input dan pengelolaan panen.
              </p>
            </div>
          )}

        </section>

        {/* SUMMARY */}
        <section className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-5">

          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <p className="text-sm text-gray-500">
              Total Panen
            </p>

            <h2 className="mt-2 text-2xl font-bold">
              {summary.totalPanen}
            </h2>
          </div>

          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <p className="text-sm text-gray-500">
              Total GKP
            </p>

            <h2 className="mt-2 text-2xl font-bold">
              {formatKg(summary.totalGkp)} kg
            </h2>
          </div>

          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <p className="text-sm text-gray-500">
              Estimasi Beras
            </p>

            <h2 className="mt-2 text-2xl font-bold">
              {formatKg(summary.totalBeras)} kg
            </h2>
          </div>

          <div className="rounded-2xl border bg-blue-50 p-4 shadow-sm">
            <p className="text-sm text-blue-700">
              Bagian Pemilik
            </p>

            <h2 className="mt-2 text-2xl font-bold text-blue-800">
              {formatKg(summary.totalPemilik)} kg
            </h2>
          </div>

          <div className="rounded-2xl border bg-yellow-50 p-4 shadow-sm">
            <p className="text-sm text-yellow-700">
              Bagian Pengelola
            </p>

            <h2 className="mt-2 text-2xl font-bold text-yellow-800">
              {formatKg(summary.totalPengelola)} kg
            </h2>
          </div>

        </section>

        {/* FILTER */}
        <section className="mb-6 rounded-2xl border bg-white p-5 shadow-sm">

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">

            <input
              type="text"
              value={searchKeyword}
              onChange={(e) =>
                setSearchKeyword(e.target.value)
              }
              placeholder="Cari lahan atau catatan"
              className="rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-green-500"
            />

            <select
              value={selectedLahanId}
              onChange={(e) =>
                setSelectedLahanId(e.target.value)
              }
              className="rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="semua">
                Semua lahan
              </option>

              {lahanList.map((lahan) => (
                <option
                  key={lahan.id}
                  value={lahan.id}
                >
                  {lahan.lokasi} - {lahan.luas} m²
                </option>
              ))}
            </select>

            <input
              type="date"
              value={tanggalMulai}
              onChange={(e) =>
                setTanggalMulai(e.target.value)
              }
              className="rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-green-500"
            />

            <input
              type="date"
              value={tanggalAkhir}
              onChange={(e) =>
                setTanggalAkhir(e.target.value)
              }
              className="rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-green-500"
            />

          </div>

          <div className="mt-4 flex justify-end">
            <button
              onClick={resetFilter}
              className="rounded-xl border px-4 py-2 text-sm font-medium hover:bg-gray-50"
            >
              Reset Filter
            </button>
          </div>

        </section>

        {/* LIST */}
        {loadingData ? (

          <section className="rounded-2xl border bg-white p-5 shadow-sm">
            Loading...
          </section>

        ) : filteredPanen.length === 0 ? (

          <section className="rounded-2xl border bg-white p-5 shadow-sm">
            Tidak ada riwayat panen.
          </section>

        ) : (

          <section className="grid grid-cols-1 gap-4 md:grid-cols-2">

            {filteredPanen.map((panen) => {
              const bagiHasil = getBagiHasil(panen)

              return (
                <article
                  key={panen.id}
                  className="rounded-2xl border bg-white p-5 shadow-sm"
                >

                  <div className="mb-4 flex items-start justify-between">

                    <div>
                      <h2 className="text-xl font-bold">
                        {panen.lahan?.lokasi}
                      </h2>

                      <p className="text-sm text-gray-500">
                        {formatDateId(panen.tanggal)}
                      </p>
                    </div>

                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-medium ${getStatusStyle(
                        panen.lahan?.status
                      )}`}
                    >
                      {formatStatus(
                        panen.lahan?.status
                      )}
                    </span>

                  </div>

                  <div className="grid grid-cols-2 gap-3">

                    <div className="rounded-xl bg-gray-50 p-3">
                      <p className="text-sm text-gray-500">
                        Total GKP
                      </p>

                      <p className="font-bold">
                        {formatKg(
                          panen.berat_gkp
                        )} kg
                      </p>
                    </div>

                    <div className="rounded-xl bg-gray-50 p-3">
                      <p className="text-sm text-gray-500">
                        Estimasi Beras
                      </p>

                      <p className="font-bold">
                        {formatKg(
                          bagiHasil?.total_beras
                        )} kg
                      </p>
                    </div>

                    <div className="rounded-xl bg-blue-50 p-3">
                      <p className="text-sm text-blue-700">
                        Pemilik
                      </p>

                      <p className="font-bold text-blue-800">
                        {formatKg(
                          bagiHasil?.porsi_pemilik
                        )} kg
                      </p>
                    </div>

                    <div className="rounded-xl bg-yellow-50 p-3">
                      <p className="text-sm text-yellow-700">
                        Pengelola
                      </p>

                      <p className="font-bold text-yellow-800">
                        {formatKg(
                          bagiHasil?.porsi_pengelola
                        )} kg
                      </p>
                    </div>

                  </div>

                  <p className="mt-4 text-sm text-gray-600">
                    {panen.catatan ||
                      "Tidak ada catatan."}
                  </p>

                  <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">

                    <button
                      onClick={() =>
                        setSelectedPanen(panen)
                      }
                      className="rounded-xl border px-4 py-2 text-sm font-medium hover:bg-gray-50"
                    >
                      Detail
                    </button>

                    <button
                      onClick={() =>
                        router.push(
                          `/lahan/${panen.lahan_id}`
                        )
                      }
                      className="rounded-xl border px-4 py-2 text-sm font-medium hover:bg-gray-50"
                    >
                      Detail Lahan
                    </button>

                    <button
                      onClick={() =>
                        router.push("/laporan")
                      }
                      className="rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
                    >
                      Buka Laporan
                    </button>

                  </div>

                </article>
              )
            })}

          </section>
        )}

      </div>

      {/* MODAL DETAIL */}
      {selectedPanen && (

        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">

          <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">

            <div className="mb-4 flex items-start justify-between">

              <div>

                <p className="text-sm font-medium text-green-700">
                  Detail Panen
                </p>

                <h2 className="text-xl font-bold">
                  {selectedPanen.lahan?.lokasi}
                </h2>

                <p className="text-sm text-gray-500">
                  {formatDateId(selectedPanen.tanggal)}
                </p>

              </div>

              <button
                onClick={() =>
                  setSelectedPanen(null)
                }
                className="rounded-xl border px-4 py-2 text-sm font-medium hover:bg-gray-50"
              >
                Tutup
              </button>

            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">

              <div className="rounded-xl bg-gray-50 p-4">
                <p className="text-sm text-gray-500">
                  Total GKP
                </p>

                <p className="font-bold">
                  {formatKg(
                    selectedPanen.berat_gkp
                  )} kg
                </p>
              </div>

              <div className="rounded-xl bg-gray-50 p-4">
                <p className="text-sm text-gray-500">
                  Estimasi Beras
                </p>

                <p className="font-bold">
                  {formatKg(
                    getBagiHasil(selectedPanen)
                      ?.total_beras
                  )} kg
                </p>
              </div>

              <div className="rounded-xl bg-blue-50 p-4">
                <p className="text-sm text-blue-700">
                  Bagian Pemilik
                </p>

                <p className="font-bold text-blue-800">
                  {formatKg(
                    getBagiHasil(selectedPanen)
                      ?.porsi_pemilik
                  )} kg
                </p>
              </div>

              <div className="rounded-xl bg-yellow-50 p-4">
                <p className="text-sm text-yellow-700">
                  Bagian Pengelola
                </p>

                <p className="font-bold text-yellow-800">
                  {formatKg(
                    getBagiHasil(selectedPanen)
                      ?.porsi_pengelola
                  )} kg
                </p>
              </div>

            </div>

          </div>
        </div>
      )}
    </main>
  )
}