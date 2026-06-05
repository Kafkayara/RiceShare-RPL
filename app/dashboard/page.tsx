"use client"

import { useEffect, useState } from "react"
import {
  LayoutDashboard,
  Map,
  CalendarDays,
  Bell,
  ClipboardList,
  Wheat,
  FileText,
  Users,
  PlusCircle,
  PencilLine,
  RefreshCcw,
  LogOut,
} from "lucide-react"

import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { syncLahanStatus } from "@/lib/syncLahanStatus"

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
  const [showProfile, setShowProfile] = useState(false)

  const [lahanAktif, setLahanAktif] = useState(0)
  const [lahanSiapPanen, setLahanSiapPanen] = useState(0)
  const [lahanIstirahat, setLahanIstirahat] = useState(0)
  const [perluPerhatian, setPerluPerhatian] = useState(0)

  useEffect(() => {
    const savedUser = localStorage.getItem("riceshare_user")

    if (!savedUser) {
      router.push("/")
      return
    }

    const parsedUser = JSON.parse(savedUser) as UserProfile
    setUser(parsedUser)

    fetchDashboard()
  }, [router])

  const fetchDashboard = async () => {
    setLoading(true)

    await syncLahanStatus()

    const { data } = await supabase
      .from("lahan")
      .select("*")

    if (data) {
      // Lahan Aktif = semua lahan yang sedang dalam siklus produksi aktif
      setLahanAktif(
        data.filter((x) =>
          ["masa_tanam_aktif", "menjelang_panen", "siap_tanam_kembali"].includes(x.status)
        ).length
      )

      // Siap Panen = khusus menjelang_panen
      setLahanSiapPanen(
        data.filter((x) => x.status === "menjelang_panen").length
      )

      // Masa Istirahat = istirahat + panen_selesai
      setLahanIstirahat(
        data.filter((x) =>
          ["istirahat", "panen_selesai"].includes(x.status)
        ).length
      )

      // Perlu Perhatian = lahan yang jadwal aktivitasnya terlewat
      // Ambil jadwal yang sudah lewat tanggal selesai tapi status belum panen_selesai
      const today = new Date().toISOString().split("T")[0]
      const { data: jadwalData } = await supabase
        .from("jadwal_tanam")
        .select("lahan_id, tanggal_selesai, status")

      if (jadwalData) {
        // Lahan yang jadwalnya sudah lewat tapi belum selesai dipanen
        const lahanTerlambat = new Set(
          jadwalData
            .filter(
              (j) =>
                j.tanggal_selesai &&
                j.tanggal_selesai < today &&
                !["panen_selesai", "istirahat", "siap_tanam_kembali", "belum_digunakan"].includes(j.status)
            )
            .map((j) => j.lahan_id)
        )
        setPerluPerhatian(lahanTerlambat.size)
      }
    }

    setLoading(false)
  }

  const handleLogout = () => {
    localStorage.removeItem("riceshare_user")
    router.push("/")
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 p-6">
        Loading...
      </main>
    )
  }

  if (!user) return null

  const isPemilik = user.role === "pemilik"
  const isPengelola = user.role === "pengelola"

  const mobileMenus = [
    {
      icon: LayoutDashboard,
      label: "Dashboard",
      path: "/dashboard",
    },
    {
      icon: Map,
      label: "Lahan",
      path: "/lahan",
    },
    {
      icon: CalendarDays,
      label: "Kalender",
      path: "/kalender",
    },
    {
      icon: Bell,
      label: "Notif",
      path: "/notifikasi",
    },
    {
      icon: ClipboardList,
      label: "Log",
      path: "/log",
    },
    {
      icon: Wheat,
      label: "Panen",
      path: "/panen/riwayat",
    },
    {
      icon: FileText,
      label: "Laporan",
      path: "/laporan",
    },
    ...(isPemilik
      ? [
          {
            icon: Users,
            label: "Pengelola",
            path: "/pengelola",
          },
        ]
      : []),

    ...(isPengelola
  ? [
      {
        icon: PlusCircle,
        label: "Tanam",
        path: "/tanam",
      },
      {
        icon: PencilLine,
        label: "Aktivitas",
        path: "/log/tambah",
      },
      {
        icon: Wheat,
        label: "Input Panen",
        path: "/panen",
      },
    ]
  : []),
  ]

  return (
    <main className="min-h-screen bg-gradient-to-br from-green-50 via-lime-50 to-emerald-100 text-gray-900">

      <div className="flex min-h-screen">

        {/* DESKTOP SIDEBAR */}
        <aside className="hidden w-72 shrink-0 border-r border-green-100 bg-white/90 p-5 shadow-2xl backdrop-blur-xl lg:block">

          <div className="mb-8 flex items-center gap-3">

            <div className="flex h-12 w-12 items-center justify-center rounded-3xl bg-gradient-to-br from-green-500 to-emerald-600 text-2xl text-white shadow-lg">
              🌾
            </div>

            <div>
              <h1 className="font-bold text-xl">
                RiceShare
              </h1>

              <p className="text-xs text-gray-500">
                {isPemilik ? "Pemilik" : "Pengelola"}
              </p>
            </div>
          </div>

          <nav className="space-y-2 text-sm">

            <button
              onClick={() => router.push("/dashboard")}
              className="flex w-full items-center gap-3 rounded-2xl bg-gradient-to-r from-green-500 to-emerald-600 px-4 py-3 text-left text-white shadow-lg"
            >
              <LayoutDashboard size={18} />
              Dashboard
            </button>

            <button
              onClick={() => router.push("/lahan")}
              className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 hover:bg-green-50"
            >
              <Map size={18} />
              Status Lahan
            </button>

            <button
              onClick={() => router.push("/kalender")}
              className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 hover:bg-green-50"
            >
              <CalendarDays size={18} />
              Kalender Tanam
            </button>

            <button
              onClick={() => router.push("/notifikasi")}
              className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 hover:bg-green-50"
            >
              <Bell size={18} />
              Notifikasi
            </button>

            <button
              onClick={() => router.push("/log")}
              className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 hover:bg-green-50"
            >
              <ClipboardList size={18} />
              Log Aktivitas
            </button>

            <button
              onClick={() => router.push("/panen/riwayat")}
              className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 hover:bg-green-50"
            >
              <Wheat size={18} />
              Riwayat Panen
            </button>

            <button
              onClick={() => router.push("/laporan")}
              className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 hover:bg-green-50"
            >
              <FileText size={18} />
              Laporan
            </button>

            {isPemilik && (
              <button
                onClick={() => router.push("/pengelola")}
                className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 hover:bg-green-50"
              >
                <Users size={18} />
                Kelola Pengelola
              </button>
            )}

           {isPengelola && (
  <>
    <button
      onClick={() => router.push("/tanam")}
      className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 hover:bg-green-50"
    >
      <PlusCircle size={18} />
      Mulai Tanam
    </button>

    <button
      onClick={() => router.push("/log/tambah")}
      className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 hover:bg-green-50"
    >
      <PencilLine size={18} />
      Tambah Aktivitas
    </button>

    <button
      onClick={() => router.push("/panen")}
      className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 hover:bg-green-50"
    >
      <Wheat size={18} />
      Input Panen
    </button>
  </>
)}
          </nav>
        </aside>

        {/* CONTENT */}
        <div className="min-w-0 flex-1 pb-28 lg:pb-0">

          {/* HEADER */}
          <header className="sticky top-0 z-30 border-b border-green-100 bg-white/80 px-4 py-4 backdrop-blur-xl">

            <div className="mx-auto flex max-w-7xl items-center justify-between">

              <div>
                <p className="text-sm font-medium text-green-700">
                  RiceShare
                </p>

                <h1 className="text-lg font-bold md:text-2xl">
                  {isPemilik
                    ? "Dashboard Pemilik"
                    : "Dashboard Pengelola"}
                </h1>
              </div>

              <div className="flex items-center gap-2">

               
                {/* MOBILE PROFILE */}
                <div className="relative lg:hidden">

                  <button
                    onClick={() => setShowProfile(!showProfile)}
                    className="flex h-10 w-10 items-center justify-center rounded-full border bg-white"
                  >
                    👤
                  </button>

                  {showProfile && (
                    <div className="absolute right-0 top-12 w-64 rounded-3xl border border-green-100 bg-white p-4 shadow-2xl">

                      <div className="flex items-center gap-3">

                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-lg">
                          👤
                        </div>

                        <div className="min-w-0">
                          <p className="truncate font-semibold">
                            {user.nama}
                          </p>

                          <p className="truncate text-sm text-gray-500">
                            {user.email}
                          </p>

                          <p className="mt-1 text-xs text-green-700">
                            {isPemilik ? "Pemilik" : "Pengelola"}
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={handleLogout}
                        className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-red-500 px-4 py-3 font-semibold text-white hover:bg-red-600"
                      >
                        <LogOut size={18} />
                        Logout
                      </button>
                    </div>
                  )}
                </div>

                {/* DESKTOP PROFILE */}
                <div className="hidden overflow-hidden rounded-xl border bg-white lg:block">

                  <div className="flex items-center gap-2 border-b px-3 py-2">

                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100">
                      👤
                    </div>

                    <div>
                      <p className="text-sm font-semibold">
                        {user.nama}
                      </p>

                      <p className="text-xs text-gray-500">
                        {isPemilik ? "Pemilik" : "Pengelola"}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={handleLogout}
                    className="block w-full px-3 py-2 text-center text-xs font-semibold text-red-600 hover:bg-red-50"
                  >
                    <div className="flex items-center justify-center gap-2">
                      <LogOut size={15} />
                      Logout
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </header>

          {/* BODY */}
          <div className="mx-auto max-w-7xl px-4 py-6">

            {/* CARD */}
            <section className="mb-6">

              <h2 className="mb-4 text-lg font-bold">
                Ringkasan Lahan
              </h2>

              <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">

                <div className="rounded-3xl border border-green-200 bg-white/80 p-4 shadow-xl md:p-6">
                  <p className="text-3xl font-bold text-green-700 md:text-4xl">
                    {lahanAktif}
                  </p>

                  <p className="mt-2 text-sm font-semibold md:text-base">
                    Lahan Aktif
                  </p>
                </div>

                <div className="rounded-3xl border border-yellow-200 bg-white/80 p-4 shadow-xl md:p-6">
                  <p className="text-3xl font-bold text-yellow-700 md:text-4xl">
                    {lahanSiapPanen}
                  </p>

                  <p className="mt-2 text-sm font-semibold md:text-base">
                    Siap Panen
                  </p>
                </div>

                <div className="rounded-3xl border border-blue-200 bg-white/80 p-4 shadow-xl md:p-6">
                  <p className="text-3xl font-bold text-blue-700 md:text-4xl">
                    {lahanIstirahat}
                  </p>

                  <p className="mt-2 text-sm font-semibold md:text-base">
                    Masa Istirahat
                  </p>
                </div>

                <div className="rounded-3xl border border-red-200 bg-white/80 p-4 shadow-xl md:p-6">
                  <p className="text-3xl font-bold text-red-700 md:text-4xl">
                    {perluPerhatian}
                  </p>

                  <p className="mt-2 text-sm font-semibold md:text-base">
                    Perlu Perhatian
                  </p>
                </div>
              </div>
            </section>

            {/* KALENDER */}
            <section className="mb-6 rounded-[28px] border border-green-100 bg-white/80 p-4 shadow-xl md:p-6">

              <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">

                <div>
                  <h2 className="text-xl font-bold text-gray-800 md:text-2xl">
                    Kalender Aktivitas
                  </h2>

                  <p className="mt-1 text-sm text-gray-500">
                    Jadwal aktivitas pertanian bulan ini
                  </p>
                </div>

                <div className="w-fit rounded-2xl bg-green-100 px-4 py-2 text-sm font-semibold text-green-700">
                  Mei 2026
                </div>
              </div>

              <div className="overflow-x-auto">

                <div className="min-w-[700px]">

                  <div className="mb-3 grid grid-cols-7 gap-3 text-center">
                    {["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"].map((day) => (
                      <div
                        key={day}
                        className="font-semibold text-gray-500"
                      >
                        {day}
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-7 gap-3">

                    {Array.from({ length: 31 }).map((_, i) => (
                      <div
                        key={i}
                        className={`flex h-20 items-start justify-start rounded-2xl border p-2 text-sm font-semibold transition-all
                        ${
                          i === 5
                            ? "border-green-500 bg-green-500 text-white shadow-lg"
                            : i === 10
                            ? "border-yellow-300 bg-yellow-100"
                            : i === 18
                            ? "border-lime-300 bg-lime-100"
                            : "border-green-100 bg-green-50 text-gray-700"
                        }`}
                      >
                        {i + 1}
                      </div>
                    ))}
                  </div>

                </div>
              </div>
            </section>

            {/* FITUR PENGELOLA */}
            {isPengelola && (
              <section className="grid grid-cols-1 gap-4 md:grid-cols-3">

                <button
                  onClick={() => router.push("/tanam")}
                  className="rounded-3xl bg-green-600 p-6 text-left text-white shadow-xl transition-all hover:scale-[1.02]"
                >
                  <PlusCircle size={32} />

                  <h2 className="mt-4 text-xl font-bold">
                    Mulai Tanam
                  </h2>

                  <p className="mt-1 text-sm text-green-100">
                    Tambahkan jadwal tanam baru
                  </p>
                </button>

                <button
                  onClick={() => router.push("/log/tambah")}
                  className="rounded-3xl bg-blue-600 p-6 text-left text-white shadow-xl transition-all hover:scale-[1.02]"
                >
                  <PencilLine size={32} />

                  <h2 className="mt-4 text-xl font-bold">
                    Tambah Aktivitas
                  </h2>

                  <p className="mt-1 text-sm text-blue-100">
                    Input aktivitas pertanian
                  </p>
                </button>

                <button
                  onClick={() => router.push("/panen")}
                  className="rounded-3xl bg-yellow-500 p-6 text-left text-white shadow-xl transition-all hover:scale-[1.02]"
                >
                  <Wheat size={32} />

                  <h2 className="mt-4 text-xl font-bold">
                    Input Panen
                  </h2>

                  <p className="mt-1 text-sm text-yellow-100">
                    Tambahkan hasil panen terbaru
                  </p>
                </button>
              </section>
            )}
          </div>
        </div>
      </div>

      {/* MOBILE BOTTOM NAV */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-green-100 bg-white/95 backdrop-blur-xl lg:hidden">

        <div className="overflow-x-auto">
          <div className="flex min-w-max px-2 py-1">

            {mobileMenus.map((item, index) => {
              const Icon = item.icon

              return (
                <button
                  key={index}
                  onClick={() => router.push(item.path)}
                  className="relative flex min-w-[78px] flex-col items-center justify-center gap-1 rounded-2xl px-3 py-3 text-gray-600 transition-all hover:bg-green-50"
                >
                  <Icon size={20} />

                  {item.label === "Notif" && perluPerhatian > 0 && (
                    <span className="absolute right-4 top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                      {perluPerhatian}
                    </span>
                  )}

                  <span className="text-[11px] font-medium whitespace-nowrap">
                    {item.label}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </nav>
    </main>
  )
}