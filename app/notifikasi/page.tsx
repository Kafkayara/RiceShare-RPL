"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

type UserProfile = {
  id: string
  nama: string
  role: "pemilik" | "pengelola"
}

type NotificationItem = {
  id: string
  title: string
  lokasi: string
  message: string
  priority: "urgent" | "today" | "soon" | "info"
}

function getNotificationColor(priority: string) {
  switch (priority) {
    case "urgent":
      return "border-red-100 bg-white/90"
    case "today":
      return "border-blue-100 bg-white/90"
    case "soon":
      return "border-amber-100 bg-white/90"
    default:
      return "border-green-100 bg-white/90"
  }
}

function getBadgeColor(priority: string) {
  switch (priority) {
    case "urgent":
      return "bg-red-100 text-red-700 border border-red-200"
    case "today":
      return "bg-blue-100 text-blue-700 border border-blue-200"
    case "soon":
      return "bg-amber-100 text-amber-700 border border-amber-200"
    default:
      return "bg-emerald-100 text-emerald-700 border border-emerald-200"
  }
}

export default function NotifikasiPage() {
  const router = useRouter()

  const [user, setUser] = useState<UserProfile | null>(null)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const savedUser = localStorage.getItem("riceshare_user")

    if (!savedUser) {
      router.push("/login")
      return
    }

    const parsedUser = JSON.parse(savedUser)
    setUser(parsedUser)

    fetchNotifications()
  }, [])

  async function fetchNotifications() {
    setLoading(true)

    const { data } = await supabase
      .from("lahan")
      .select("*")

    const dummyNotifications: NotificationItem[] =
      (data || []).map((item: any, index: number) => ({
        id: item.id,
        lokasi: item.lokasi,
        title:
          index % 2 === 0
            ? `Cek Aktivitas - ${item.lokasi}`
            : `Panen Mendekat - ${item.lokasi}`,
        message:
          index % 2 === 0
            ? "Ada aktivitas yang perlu diperiksa."
            : "Panen diperkirakan dalam beberapa hari.",
        priority:
          index % 3 === 0
            ? "urgent"
            : index % 3 === 1
            ? "today"
            : "soon",
      }))

    setNotifications(dummyNotifications)
    setLoading(false)
  }

  if (!user) return null

  const isPemilik = user.role === "pemilik"
  const isPengelola = user.role === "pengelola"

  return (
    <main className="min-h-screen bg-gradient-to-br from-green-50 via-lime-50 to-emerald-100 text-gray-900">
  <div className="mx-auto w-full max-w-4xl px-4 py-4 md:px-6 md:py-6">
      {/* HEADER */}
      <header className="mb-6 rounded-3xl border border-green-100 bg-white/80 p-4 shadow-lg backdrop-blur-sm md:flex md:items-center md:justify-between">
        <div>
          <p className="text-sm font-medium text-green-700">
            RiceShare
          </p>

          <h1 className="text-2xl font-bold">
           Notifikasi
          </h1>

          <p className="text-sm text-gray-500">
            Monitoring aktivitas dan pengingat lahan
          </p>
        </div>

        <button
          onClick={() => router.push("/dashboard")}
          className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-green-500 to-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-lg transition-all hover:scale-[1.02]"
        >
          Dashboard
        </button>
      </header>

      {/* ROLE INFO */}
      <div className="mb-6">

        {isPemilik && (
          <div className="rounded-3xl border border-green-100 bg-white/80 p-5 shadow-lg backdrop-blur-sm">
            <p className="font-semibold text-emerald-700">
              👨‍🌾 Mode Pemilik
            </p>

            <p className="mt-1 text-sm text-slate-600">
              Pemilik hanya dapat memonitor aktivitas lahan.
            </p>
          </div>
        )}

        {isPengelola && (
          <div className="rounded-3xl border border-green-100 bg-white/80 p-5 shadow-lg backdrop-blur-sm">
            <p className="font-semibold text-emerald-700">
              🧑‍🌾 Mode Pengelola
            </p>

            <p className="text-sm text-slate-600 mt-1">
              Pengelola dapat menambahkan log aktivitas.
            </p>
          </div>
        )}
      </div>

      {/* LOADING */}
      {loading ? (
        <div className="rounded-3xl border border-green-100 bg-white/80 p-6 shadow-lg backdrop-blur-sm">
          Loading...
        </div>
      ) : notifications.length === 0 ? (
        <div className="rounded-3xl border border-green-100 bg-white/80 p-6 shadow-lg backdrop-blur-sm">
          Tidak ada notifikasi.
        </div>
      ) : (

        /* LIST NOTIFIKASI */
        <div className="space-y-4">

          {notifications.map((notif) => (

            <div
              key={notif.id}
              className={`rounded-3xl border p-5 shadow-lg backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${getNotificationColor(
                notif.priority
              )}`}
            >

              {/* TOP */}
              <div className="mb-3 flex items-start justify-between">

                <div>

                  <div className="flex items-center gap-2">

                    <h2 className="text-lg font-bold">
                      {notif.title}
                    </h2>

                    {isPemilik && (
                      <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-700">
                        Pemilik
                      </span>
                    )}

                    {isPengelola && (
                      <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-semibold text-emerald-700">
                        Pengelola
                      </span>
                    )}
                  </div>

                  <p className="text-sm text-gray-500">
                    📍 {notif.lokasi}
                  </p>
                </div>

                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${getBadgeColor(
                  notif.priority
                  )}`}
                >
                  {notif.priority}
                </span>
              </div>

              {/* MESSAGE */}
              <p className="mb-4 text-slate-700 leading-relaxed">
                {notif.message}
              </p>

              {/* ACTION */}
              <div className="flex flex-wrap gap-3">

                <button
                  onClick={() =>
                    router.push(`/lahan/${notif.id}`)
                  }
                  className="rounded-xl border bg-white px-4 py-2 text-sm font-medium hover:bg-gray-100"
                >
                  Detail Lahan
                </button>

                {isPengelola && (
                  <button
                    onClick={() =>
                      router.push("/log/tambah")
                    }
                    className="rounded-2xl bg-gradient-to-r from-green-500 to-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-lg transition-all hover:scale-[1.02]"
                  >
                    Tambah Log Aktivitas
                  </button>
                )}

              </div>
            </div>
          ))}
        </div>
      )}
      </div>
    </main>
  )
}