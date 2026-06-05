"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { syncLahanStatus } from "@/lib/syncLahanStatus"

type UserProfile = {
  id: string
  nama: string
  role: "pemilik" | "pengelola"
}

type NotificationItem = {
  id: string
  lahan_id: string
  lokasi: string
  title: string
  message: string
  priority: "urgent" | "today" | "soon" | "info"
}

function getNotificationColor(priority: string) {
  switch (priority) {
    case "urgent": return "border-red-200 bg-red-50/80"
    case "today":  return "border-blue-200 bg-blue-50/80"
    case "soon":   return "border-amber-200 bg-amber-50/80"
    default:       return "border-green-100 bg-white/90"
  }
}

function getBadgeColor(priority: string) {
  switch (priority) {
    case "urgent": return "bg-red-100 text-red-700 border border-red-200"
    case "today":  return "bg-blue-100 text-blue-700 border border-blue-200"
    case "soon":   return "bg-amber-100 text-amber-700 border border-amber-200"
    default:       return "bg-emerald-100 text-emerald-700 border border-emerald-200"
  }
}

function getPriorityLabel(priority: string) {
  switch (priority) {
    case "urgent": return "Mendesak"
    case "today":  return "Hari Ini"
    case "soon":   return "Segera"
    default:       return "Info"
  }
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().split("T")[0]
}

function getToday(): string {
  return new Date().toISOString().split("T")[0]
}

function diffDays(a: string, b: string): number {
  return Math.floor(
    (new Date(b).getTime() - new Date(a).getTime()) / (1000 * 60 * 60 * 24)
  )
}

export default function NotifikasiPage() {
  const router = useRouter()

  const [user, setUser] = useState<UserProfile | null>(null)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const savedUser = localStorage.getItem("riceshare_user")
    if (!savedUser) { router.push("/"); return }
    const parsedUser = JSON.parse(savedUser)
    setUser(parsedUser)
    fetchNotifications()
  }, [])

  async function fetchNotifications() {
    setLoading(true)

    // Sync dulu agar status lahan up-to-date
    await syncLahanStatus()

    const today = getToday()
    const notifs: NotificationItem[] = []

    // ── 1. Ambil semua lahan beserta jadwal tanam terbaru ──────────────────
    const { data: lahanData } = await supabase
      .from("lahan")
      .select(`
        id, lokasi, status,
        jadwal_tanam (
          id, tanggal_mulai, tanggal_selesai, status,
          timeline_overrides, created_at
        )
      `)

    if (lahanData) {
      for (const lahan of lahanData) {
        const jadwalList = (lahan.jadwal_tanam as any[]) || []
        // Ambil jadwal terbaru
        const jadwal = jadwalList.sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )[0]

        if (!jadwal?.tanggal_mulai) {
          // Lahan belum punya jadwal tanam sama sekali
          notifs.push({
            id: `no-jadwal-${lahan.id}`,
            lahan_id: lahan.id,
            lokasi: lahan.lokasi || "Lahan",
            title: `Lahan ${lahan.lokasi} belum memiliki jadwal tanam`,
            message: "Segera tambahkan jadwal musim tanam untuk lahan ini.",
            priority: "info",
          })
          continue
        }

        const overrides = (jadwal.timeline_overrides as Record<string,string>) || {}
        const tglPanenEst = overrides["panen_estimasi"] || addDays(jadwal.tanggal_mulai, 105)
        const tglMenjelang = overrides["menjelang_panen"] || addDays(jadwal.tanggal_mulai, 70)
        const tglIstirahat = overrides["masa_istirahat"] || addDays(jadwal.tanggal_mulai, 119)

        const hariMenujuPanen = diffDays(today, tglPanenEst)
        const hariMenujuMenjelang = diffDays(today, tglMenjelang)

        // ── Notifikasi berdasarkan status lahan saat ini ─────────────────
        const status = lahan.status

        if (status === "menjelang_panen") {
          if (hariMenujuPanen <= 0) {
            notifs.push({
              id: `panen-terlambat-${lahan.id}`,
              lahan_id: lahan.id,
              lokasi: lahan.lokasi,
              title: `Panen ${lahan.lokasi} sudah melewati estimasi`,
              message: `Estimasi panen ${tglPanenEst} sudah lewat. Segera input hasil panen.`,
              priority: "urgent",
            })
          } else if (hariMenujuPanen <= 3) {
            notifs.push({
              id: `panen-segera-${lahan.id}`,
              lahan_id: lahan.id,
              lokasi: lahan.lokasi,
              title: `Panen ${lahan.lokasi} ${hariMenujuPanen} hari lagi`,
              message: `Lahan ini menjelang panen. Estimasi: ${tglPanenEst}.`,
              priority: "today",
            })
          } else {
            notifs.push({
              id: `menjelang-panen-${lahan.id}`,
              lahan_id: lahan.id,
              lokasi: lahan.lokasi,
              title: `${lahan.lokasi} menjelang panen`,
              message: `Estimasi panen pada ${tglPanenEst} (${hariMenujuPanen} hari lagi). Persiapkan proses panen.`,
              priority: "soon",
            })
          }
        } else if (status === "masa_tanam_aktif") {
          if (hariMenujuMenjelang <= 7 && hariMenujuMenjelang > 0) {
            notifs.push({
              id: `mendekati-menjelang-${lahan.id}`,
              lahan_id: lahan.id,
              lokasi: lahan.lokasi,
              title: `${lahan.lokasi} akan memasuki masa menjelang panen`,
              message: `${hariMenujuMenjelang} hari lagi lahan ini memasuki fase menjelang panen.`,
              priority: "soon",
            })
          }
        } else if (status === "panen_selesai") {
          notifs.push({
            id: `input-panen-${lahan.id}`,
            lahan_id: lahan.id,
            lokasi: lahan.lokasi,
            title: `Input hasil panen ${lahan.lokasi}`,
            message: "Panen selesai. Segera masukkan data hasil panen untuk menghitung bagi hasil.",
            priority: "urgent",
          })
        } else if (status === "siap_tanam_kembali") {
          notifs.push({
            id: `siap-tanam-${lahan.id}`,
            lahan_id: lahan.id,
            lokasi: lahan.lokasi,
            title: `${lahan.lokasi} siap tanam kembali`,
            message: "Masa istirahat selesai. Lahan siap untuk musim tanam berikutnya.",
            priority: "info",
          })
        }
      }
    }

    // ── 2. Ambil log aktivitas yang statusnya masih pending ────────────────
    const { data: logPending } = await supabase
      .from("aktivitas_log")
      .select("id, jenis_aktivitas, tanggal, lahan_id, lahan:lahan_id(lokasi)")
      .not("id", "in",
        `(${
          // Ambil ID aktivitas yang sudah diverifikasi
          (await supabase.from("verifikasi_log").select("aktivitas_id"))
            .data?.map((v: any) => `'${v.aktivitas_id}'`).join(",") || "''"
        })`
      )
      .order("tanggal", { ascending: false })
      .limit(10)

    if (logPending) {
      for (const log of logPending) {
        const lokasi = (log.lahan as any)?.lokasi || "Lahan"
        const hariLalu = diffDays(log.tanggal, today)
        notifs.push({
          id: `pending-log-${log.id}`,
          lahan_id: log.lahan_id,
          lokasi,
          title: `Log ${log.jenis_aktivitas} ${lokasi} menunggu verifikasi`,
          message: `Aktivitas ${log.jenis_aktivitas} pada ${log.tanggal} belum diverifikasi (${hariLalu} hari lalu).`,
          priority: hariLalu > 3 ? "urgent" : hariLalu === 0 ? "today" : "soon",
        })
      }
    }

    // Urutkan: urgent → today → soon → info
    const order = { urgent: 0, today: 1, soon: 2, info: 3 }
    notifs.sort((a, b) => order[a.priority] - order[b.priority])

    setNotifications(notifs)
    setLoading(false)
  }

  if (!user) return null

  const isPemilik = user.role === "pemilik"
  const isPengelola = user.role === "pengelola"

  const urgentCount = notifications.filter((n) => n.priority === "urgent").length

  return (
    <main className="min-h-screen bg-gradient-to-br from-green-50 via-lime-50 to-emerald-100 text-gray-900">
      <div className="mx-auto w-full max-w-4xl px-4 py-4 md:px-6 md:py-6">

        {/* HEADER */}
        <header className="mb-6 rounded-3xl border border-green-100 bg-white/80 p-4 shadow-lg backdrop-blur-sm md:flex md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium text-green-700">RiceShare</p>
            <h1 className="flex items-center gap-3 text-2xl font-bold">
              Notifikasi
              {urgentCount > 0 && (
                <span className="rounded-full bg-red-500 px-2.5 py-0.5 text-sm font-bold text-white">
                  {urgentCount}
                </span>
              )}
            </h1>
            <p className="text-sm text-gray-500">
              Monitoring aktivitas dan pengingat lahan — data real-time
            </p>
          </div>

          <div className="mt-3 flex gap-2 md:mt-0">
            <button
              onClick={() => fetchNotifications()}
              className="flex items-center gap-2 rounded-2xl border border-green-100 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-green-50"
            >
              🔄 Refresh
            </button>
            <button
              onClick={() => router.push("/dashboard")}
              className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-green-500 to-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition-all hover:scale-[1.02]"
            >
              Dashboard
            </button>
          </div>
        </header>

        {/* ROLE INFO */}
        <div className="mb-6">
          {isPemilik && (
            <div className="rounded-3xl border border-green-100 bg-white/80 p-4 shadow-lg">
              <p className="font-semibold text-emerald-700">👨‍🌾 Mode Pemilik</p>
              <p className="mt-1 text-sm text-slate-600">Pantau status lahan dan verifikasi aktivitas pengelola.</p>
            </div>
          )}
          {isPengelola && (
            <div className="rounded-3xl border border-green-100 bg-white/80 p-4 shadow-lg">
              <p className="font-semibold text-emerald-700">🧑‍🌾 Mode Pengelola</p>
              <p className="mt-1 text-sm text-slate-600">Perhatikan jadwal dan segera catat aktivitas yang diperlukan.</p>
            </div>
          )}
        </div>

        {/* LIST */}
        {loading ? (
          <div className="rounded-3xl border border-green-100 bg-white/80 p-6 shadow-lg">
            <p className="text-sm text-gray-500">Memuat notifikasi...</p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="rounded-3xl border border-green-100 bg-white/80 p-8 text-center shadow-lg">
            <p className="text-4xl">✅</p>
            <p className="mt-3 font-semibold text-gray-700">Semua lahan dalam kondisi baik</p>
            <p className="mt-1 text-sm text-gray-500">Tidak ada notifikasi saat ini.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {notifications.map((notif) => (
              <div
                key={notif.id}
                className={`rounded-3xl border p-5 shadow-lg backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${getNotificationColor(notif.priority)}`}
              >
                {/* TOP */}
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="font-bold text-gray-800">{notif.title}</h2>
                    <p className="mt-0.5 text-sm text-gray-500">📍 {notif.lokasi}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${getBadgeColor(notif.priority)}`}>
                    {getPriorityLabel(notif.priority)}
                  </span>
                </div>

                {/* MESSAGE */}
                <p className="mb-4 text-sm leading-relaxed text-slate-700">{notif.message}</p>

                {/* ACTION */}
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() => router.push(`/lahan/${notif.lahan_id}`)}
                    className="rounded-xl border bg-white px-4 py-2 text-sm font-medium hover:bg-gray-50"
                  >
                    Detail Lahan
                  </button>

                  {isPengelola && (
                    <button
                      onClick={() => router.push(`/log/tambah?lahan_id=${notif.lahan_id}`)}
                      className="rounded-2xl bg-gradient-to-r from-green-500 to-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-lg transition-all hover:scale-[1.02]"
                    >
                      Tambah Log
                    </button>
                  )}

                  {isPengelola && notif.id.startsWith("panen") && (
                    <button
                      onClick={() => router.push("/panen")}
                      className="rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2 text-sm font-semibold text-white shadow-lg transition-all hover:scale-[1.02]"
                    >
                      Input Panen
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