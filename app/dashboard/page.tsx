"use client"
export const dynamic = "force-dynamic"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

type UserProfile = {
  id: string
  nama: string
  email: string
  role: "pemilik" | "pengelola"
}

export default function DashboardPage() {
  const router = useRouter()

  const [user, setUser] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  const [totalLahan, setTotalLahan] = useState(0)
  const [totalPanen, setTotalPanen] = useState(0)
  const [totalJadwalTanam, setTotalJadwalTanam] = useState(0)

  useEffect(() => {
    const savedUser = localStorage.getItem("riceshare_user")

    if (!savedUser) {
      router.push("/")
      return
    }

    const parsedUser = JSON.parse(savedUser) as UserProfile
    setUser(parsedUser)
    setLoading(false)
  }, [router])

  useEffect(() => {
    const fetchDashboardData = async () => {
      const { count: lahanCount, error: lahanError } = await supabase
        .from("lahan")
        .select("*", { count: "exact", head: true })

      if (!lahanError) {
        setTotalLahan(lahanCount || 0)
      }

      const { count: panenCount, error: panenError } = await supabase
        .from("panen")
        .select("*", { count: "exact", head: true })

      if (!panenError) {
        setTotalPanen(panenCount || 0)
      }

      const { count: jadwalCount, error: jadwalError } = await supabase
        .from("jadwal_tanam")
        .select("*", { count: "exact", head: true })

      if (!jadwalError) {
        setTotalJadwalTanam(jadwalCount || 0)
      }
    }

    fetchDashboardData()
  }, [])

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

  if (!user) {
    return null
  }

  const isPemilik = user.role === "pemilik"
  const isPengelola = user.role === "pengelola"

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900">
      <div className="mx-auto w-full max-w-6xl px-4 py-4 md:px-6 md:py-6">
        <header className="mb-6 flex flex-col gap-4 rounded-2xl border bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium text-green-700">RiceShare</p>

            <h1 className="text-2xl font-bold">
              {isPemilik ? "Dashboard Pemilik" : "Dashboard Pengelola"}
            </h1>

            <p className="text-sm text-gray-500">
              Selamat datang, {user.nama}
            </p>
          </div>

          <button
            onClick={handleLogout}
            className="rounded-xl border px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
          >
            Logout
          </button>
        </header>

        <section className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">Total Lahan</p>
            <h2 className="mt-2 text-3xl font-bold">{totalLahan}</h2>
          </div>

          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">Data Panen</p>
            <h2 className="mt-2 text-3xl font-bold">{totalPanen}</h2>
          </div>

          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">Musim Tanam</p>
            <h2 className="mt-2 text-3xl font-bold">{totalJadwalTanam}</h2>
          </div>
        </section>

        {isPemilik && (
          <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <h2 className="mb-2 text-lg font-bold">Monitoring Pemilik</h2>

              <p className="text-sm text-gray-500">
                Pemilik dapat memantau kondisi lahan, musim tanam, hasil panen,
                dan bagi hasil. Fitur input operasional hanya tersedia untuk
                pengelola.
              </p>

              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <button
                  onClick={() => router.push("/lahan")}
                  className="rounded-xl border px-4 py-3 text-left text-sm font-medium hover:bg-gray-50"
                >
                  Status Lahan
                </button>

                <button
                  onClick={() => router.push("/panen")}
                  className="rounded-xl border px-4 py-3 text-left text-sm font-medium hover:bg-gray-50"
                >
                  Lihat Data Panen
                </button>

                <button
                  disabled
                  className="cursor-not-allowed rounded-xl border bg-gray-50 px-4 py-3 text-left text-sm font-medium text-gray-400"
                >
                  Kelola Pengelola
                </button>

                <button
                  disabled
                  className="cursor-not-allowed rounded-xl border bg-gray-50 px-4 py-3 text-left text-sm font-medium text-gray-400"
                >
                  Laporan Bagi Hasil
                </button>
              </div>
            </div>

            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <h2 className="mb-2 text-lg font-bold">Ringkasan Akses</h2>

              <div className="space-y-3 text-sm">
                <div className="rounded-xl bg-gray-50 p-3">
                  Bisa melihat status dan detail lahan.
                </div>

                <div className="rounded-xl bg-gray-50 p-3">
                  Bisa melihat hasil panen dan bagi hasil.
                </div>

                <div className="rounded-xl bg-gray-50 p-3">
                  Tidak bisa melakukan mulai tanam atau input panen.
                </div>
              </div>
            </div>
          </section>
        )}

        {isPengelola && (
          <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <h2 className="mb-2 text-lg font-bold">Aksi Operasional</h2>

              <p className="text-sm text-gray-500">
                Pengelola dapat menjalankan aktivitas operasional seperti mulai
                tanam, input panen, dan nantinya input log aktivitas.
              </p>

              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <button
                  onClick={() => router.push("/tanam")}
                  className="rounded-xl bg-green-600 px-4 py-3 text-left text-sm font-semibold text-white hover:bg-green-700"
                >
                  Mulai Tanam
                </button>

                <button
                  onClick={() => router.push("/panen")}
                  className="rounded-xl border px-4 py-3 text-left text-sm font-medium hover:bg-gray-50"
                >
                  Input Panen
                </button>

                <button
                  onClick={() => router.push("/lahan")}
                  className="rounded-xl border px-4 py-3 text-left text-sm font-medium hover:bg-gray-50"
                >
                  Status Lahan
                </button>

                <button
                  disabled
                  className="cursor-not-allowed rounded-xl border bg-gray-50 px-4 py-3 text-left text-sm font-medium text-gray-400"
                >
                  Input Log Aktivitas
                </button>

                <button
                  disabled
                  className="cursor-not-allowed rounded-xl border bg-gray-50 px-4 py-3 text-left text-sm font-medium text-gray-400"
                >
                  Edit Jadwal
                </button>
              </div>
            </div>

            <div className="rounded-2xl border bg-white p-5 shadow-sm">
              <h2 className="mb-2 text-lg font-bold">Ringkasan Akses</h2>

              <div className="space-y-3 text-sm">
                <div className="rounded-xl bg-gray-50 p-3">
                  Bisa memulai musim tanam pada lahan yang siap tanam.
                </div>

                <div className="rounded-xl bg-gray-50 p-3">
                  Bisa input data panen dan menjalankan bagi hasil otomatis.
                </div>

                <div className="rounded-xl bg-gray-50 p-3">
                  Bisa melihat status lahan dan nanti mencatat log aktivitas.
                </div>
              </div>
            </div>
          </section>
        )}
      </div>
    </main>
  )
}