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
      return "border-red-200 bg-red-50"
    case "today":
      return "border-blue-200 bg-blue-50"
    case "soon":
      return "border-yellow-200 bg-yellow-50"
    default:
      return "border-green-200 bg-green-50"
  }
}

function getBadgeColor(priority: string) {
  switch (priority) {
    case "urgent":
      return "bg-red-100 text-red-700"
    case "today":
      return "bg-blue-100 text-blue-700"
    case "soon":
      return "bg-yellow-100 text-yellow-700"
    default:
      return "bg-green-100 text-green-700"
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
    <main className="min-h-screen bg-gray-50 p-6 text-gray-900">

      {/* HEADER */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <p className="text-green-700 font-semibold">
            RiceShare
          </p>

          <h1 className="text-3xl font-bold">
            🔔 Notifikasi
          </h1>

          <p className="text-gray-500 mt-1">
            Monitoring aktivitas dan pengingat lahan
          </p>
        </div>

        <button
          onClick={() => router.push("/dashboard")}
          className="rounded-xl border bg-white px-5 py-3 font-medium hover:bg-gray-100"
        >
          Dashboard
        </button>
      </div>

      {/* ROLE INFO */}
      <div className="mb-6">

        {isPemilik && (
          <div className="rounded-2xl border border-green-200 bg-green-50 p-4">
            <p className="font-semibold text-green-700">
              👨‍🌾 Mode Pemilik
            </p>

            <p className="text-sm text-green-600 mt-1">
              Pemilik hanya dapat memonitor aktivitas lahan.
            </p>
          </div>
        )}

        {isPengelola && (
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
            <p className="font-semibold text-blue-700">
              🧑‍🌾 Mode Pengelola
            </p>

            <p className="text-sm text-blue-600 mt-1">
              Pengelola dapat menambahkan log aktivitas.
            </p>
          </div>
        )}
      </div>

      {/* LOADING */}
      {loading ? (
        <div className="rounded-2xl border bg-white p-6">
          Loading...
        </div>
      ) : notifications.length === 0 ? (
        <div className="rounded-2xl border bg-white p-6">
          Tidak ada notifikasi.
        </div>
      ) : (

        /* LIST NOTIFIKASI */
        <div className="space-y-4">

          {notifications.map((notif) => (

            <div
              key={notif.id}
              className={`rounded-2xl border p-5 shadow-sm transition hover:shadow-md ${getNotificationColor(
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
                      <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-700">
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
              <p className="text-gray-700 mb-4">
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
                    className="rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
                  >
                    Tambah Log Aktivitas
                  </button>
                )}

              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  )
}