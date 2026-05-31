"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

type UserProfile = {
  id: string
  nama: string
  email: string
  role: "pemilik" | "pengelola"
}

type AktivitasLogDetail = {
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

export default function DetailLogAktivitasPage() {
  const router = useRouter()
  const params = useParams()
  const logId = params.id as string

  const [user, setUser] = useState<UserProfile | null>(null)
  const [checkingUser, setCheckingUser] = useState(true)
  const [loadingData, setLoadingData] = useState(true)
  const [logDetail, setLogDetail] = useState<AktivitasLogDetail | null>(null)

  useEffect(() => {
    const savedUser = localStorage.getItem("riceshare_user")

    if (!savedUser) {
      router.push("/")
      return
    }

    setUser(JSON.parse(savedUser))
    setCheckingUser(false)
  }, [router])

  const fetchLogDetail = async () => {
    setLoadingData(true)

    const { data, error } = await supabase
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
      .eq("id", logId)
      .single()

    if (error) {
      console.log("FETCH LOG DETAIL ERROR:", error)
      setLogDetail(null)
      setLoadingData(false)
      return
    }

    setLogDetail(data as unknown as AktivitasLogDetail)
    setLoadingData(false)
  }

  useEffect(() => {
    if (!checkingUser && user && logId) {
      fetchLogDetail()
    }
  }, [checkingUser, user, logId])

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
    <main className="min-h-screen bg-gradient-to-br from-green-50 via-lime-50 to-emerald-100 text-gray-900">
      <div className="mx-auto w-full max-w-4xl px-4 py-4 md:px-6 md:py-6">
        <header className="mb-6 overflow-hidden rounded-[30px] border border-green-100 bg-white/80 p-5 shadow-2xl backdrop-blur-xl">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <button
              onClick={() => router.push("/log")}
              className="rounded-2xl border border-green-100 bg-white px-5 py-3 text-sm font-semibold text-gray-700 transition-all hover:bg-green-50"
            >
              ← Kembali ke Riwayat Log
            </button>

            <button
              onClick={() => router.push("/dashboard")}
              className="rounded-2xl border border-green-100 bg-white px-5 py-3 text-sm font-semibold text-gray-700 transition-all hover:bg-green-50"
            >
              Dashboard
            </button>
          </div>

          <p className="text-sm font-semibold tracking-wide text-green-700">RiceShare</p>
          <h1 className="text-2xl font-bold">Detail Log Aktivitas</h1>
          <p className="text-sm text-gray-500">
            Informasi lengkap aktivitas pengelolaan lahan.
          </p>
        </header>

        {loadingData ? (
          <section className="rounded-2xl border bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">Memuat detail log...</p>
          </section>
        ) : !logDetail ? (
          <section className="rounded-2xl border bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">
              Data log aktivitas tidak ditemukan.
            </p>
          </section>
        ) : (
          <>
            <section className="mb-6 rounded-[28px] border border-green-100 bg-white/90 p-6 shadow-xl backdrop-blur-sm">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <span className="mb-3 inline-flex items-center rounded-full border border-green-200 bg-green-50 px-4 py-1.5 text-xs font-semibold text-green-700">
                    {logDetail.jenis_aktivitas}
                  </span>

                  <h2 className="text-2xl font-bold">
                    {logDetail.lahan?.lokasi || "Lahan tidak diketahui"}
                  </h2>

                  <p className="text-sm text-gray-500">
                    {formatDateId(logDetail.tanggal)} • Dicatat{" "}
                    {formatDateTimeId(logDetail.created_at)}
                  </p>
                </div>

                <span
                  className={`w-fit rounded-full border px-3 py-1 text-xs font-medium ${getStatusStyle(
                    logDetail.lahan?.status
                  )}`}
                >
                  {formatStatus(logDetail.lahan?.status)}
                </span>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-green-100 bg-green-50/50 p-4">
                  <p className="text-sm text-gray-500">Lahan</p>
                  <p className="font-bold">
                    {logDetail.lahan?.lokasi || "-"}
                  </p>
                </div>

                <div className="rounded-2xl border border-green-100 bg-green-50/50 p-4">
                  <p className="text-sm text-gray-500">Luas Lahan</p>
                  <p className="font-bold">
                    {logDetail.lahan?.luas || "-"} m²
                  </p>
                </div>

                <div className="rounded-2xl border border-green-100 bg-green-50/50 p-4">
                  <p className="text-sm text-gray-500">Tanggal Aktivitas</p>
                  <p className="font-bold">{formatDateId(logDetail.tanggal)}</p>
                </div>

                <div className="rounded-2xl border border-green-100 bg-green-50/50 p-4">
                  <p className="text-sm text-gray-500">Jenis Aktivitas</p>
                  <p className="font-bold">{logDetail.jenis_aktivitas}</p>
                </div>

                <div className="rounded-2xl border border-green-100 bg-gradient-to-br from-green-50 to-white p-5 md:col-span-2">
                  <p className="mb-2 text-sm text-gray-500">Deskripsi</p>
                  <p className="whitespace-pre-line text-sm leading-relaxed text-gray-800">
                    {logDetail.deskripsi || "Tidak ada deskripsi."}
                  </p>
                </div>
              </div>
            </section>

            {logDetail.bukti && (
              <section className="mb-6 rounded-[28px] border border-green-100 bg-white/90 p-6 shadow-xl backdrop-blur-sm">
                <h2 className="mb-3 text-lg font-bold">Bukti Aktivitas</h2>

                <div className="rounded-2xl border border-green-100 bg-green-50/50 p-4">
                  <img
                    src={logDetail.bukti}
                    alt="Bukti aktivitas"
                    className="max-h-[520px] w-full rounded-2xl object-contain shadow-md"
                  />
                </div>

                <a
                  href={logDetail.bukti}
                  target="_blank"
                  className="mt-4 inline-flex items-center text-sm font-semibold text-green-700 transition hover:text-green-800 hover:underline"
                >
                  Buka bukti di tab baru
                </a>
              </section>
            )}

            <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                onClick={() => router.push(`/lahan/${logDetail.lahan_id}`)}
                className="rounded-2xl border border-gray-200 bg-white px-5 py-3 text-sm font-medium transition-all hover:bg-gray-50"
              >
                Buka Detail Lahan
              </button>

              {isPengelola && (
                <button
                  onClick={() =>
                    router.push(`/log/tambah?lahan_id=${logDetail.lahan_id}`)
                  }
                  className="rounded-2xl bg-gradient-to-r from-green-500 to-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-lg transition-all hover:scale-[1.02]"
                >
                  Tambah Log Aktivitas
                </button>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  )
}