"use client"

import { useEffect, useRef, useState } from "react"
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

type FormErrors = {
  lahanId?: string
  tanggalMulai?: string
  varietasPadi?: string
  jumlahBenih?: string
}

type TimelineItem = {
  label: string
  tanggal: string
}

type ResultData = {
  lokasi_lahan: string
  tanggal_mulai: string
  panen_mulai: string
  panen_selesai: string
  siap_tanam_kembali: string
  varietas_padi: string
  jumlah_benih: number
  estimasi_gabah_min: number
  estimasi_gabah_max: number
  timeline: TimelineItem[]
}

function getTodayDateInputValue() {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, "0")
  const day = String(today.getDate()).padStart(2, "0")

  return `${year}-${month}-${day}`
}

function addDays(dateString: string, days: number) {
  const date = new Date(dateString)
  date.setDate(date.getDate() + days)

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")

  return `${year}-${month}-${day}`
}

function formatDateId(dateString: string) {
  return new Date(dateString).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)
}

function buildTimeline(tanggalMulai: string): TimelineItem[] {
  return [
    {
      label: "Mulai Tanam",
      tanggal: formatDateId(tanggalMulai),
    },
    {
      label: "Cek Adaptasi Bibit",
      tanggal: `${formatDateId(addDays(tanggalMulai, 1))} - ${formatDateId(
        addDays(tanggalMulai, 7)
      )}`,
    },
    {
      label: "Pemupukan 1",
      tanggal: `${formatDateId(addDays(tanggalMulai, 7))} - ${formatDateId(
        addDays(tanggalMulai, 14)
      )}`,
    },
    {
      label: "Pantau Pertumbuhan Awal",
      tanggal: `${formatDateId(addDays(tanggalMulai, 14))} - ${formatDateId(
        addDays(tanggalMulai, 21)
      )}`,
    },
    {
      label: "Persiapan Pengendalian Gulma",
      tanggal: `${formatDateId(addDays(tanggalMulai, 21))} - ${formatDateId(
        addDays(tanggalMulai, 30)
      )}`,
    },
    {
      label: "Bersihkan Gulma",
      tanggal: formatDateId(addDays(tanggalMulai, 30)),
    },
    {
      label: "Pemupukan 2",
      tanggal: `${formatDateId(addDays(tanggalMulai, 35))} - ${formatDateId(
        addDays(tanggalMulai, 40)
      )}`,
    },
    {
      label: "Perawatan Lanjutan",
      tanggal: `${formatDateId(addDays(tanggalMulai, 40))} - ${formatDateId(
        addDays(tanggalMulai, 60)
      )}`,
    },
    {
      label: "Cek Hama",
      tanggal: formatDateId(addDays(tanggalMulai, 60)),
    },
    {
      label: "Menjelang Panen",
      tanggal: `${formatDateId(addDays(tanggalMulai, 70))} - ${formatDateId(
        addDays(tanggalMulai, 85)
      )}`,
    },
    {
      label: "Panen Estimasi",
      tanggal: `${formatDateId(addDays(tanggalMulai, 80))} - ${formatDateId(
        addDays(tanggalMulai, 105)
      )}`,
    },
    {
      label: "Masa Istirahat",
      tanggal: `${formatDateId(addDays(tanggalMulai, 106))} - ${formatDateId(
        addDays(tanggalMulai, 119)
      )}`,
    },
    {
      label: "Siap Tanam Kembali",
      tanggal: `Mulai ${formatDateId(addDays(tanggalMulai, 120))}`,
    },
  ]
}

export default function TanamPage() {
  const router = useRouter()

  const [user, setUser] = useState<UserProfile | null>(null)
  const [checkingUser, setCheckingUser] = useState(true)

  const [lahanList, setLahanList] = useState<Lahan[]>([])
  const [lahanId, setLahanId] = useState("")
  const [tanggalMulai, setTanggalMulai] = useState("")
  const [varietasPadi, setVarietasPadi] = useState("")
  const [jumlahBenih, setJumlahBenih] = useState("")
  const [catatan, setCatatan] = useState("")

  const [errors, setErrors] = useState<FormErrors>({})
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ResultData | null>(null)
  const [showResultModal, setShowResultModal] = useState(false)

  const lahanRef = useRef<HTMLSelectElement | null>(null)
  const tanggalRef = useRef<HTMLInputElement | null>(null)
  const varietasRef = useRef<HTMLInputElement | null>(null)
  const benihRef = useRef<HTMLInputElement | null>(null)

  const today = getTodayDateInputValue()

  const fetchLahan = async () => {
    const { data, error } = await supabase
      .from("lahan")
      .select("id, lokasi, luas, status")
      .eq("status", "siap_tanam_kembali")
      .order("lokasi", { ascending: true })

    if (error) {
      console.log("FETCH LAHAN ERROR:", error)
      return
    }

    setLahanList(data || [])
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

  const resetForm = () => {
    setLahanId("")
    setTanggalMulai("")
    setVarietasPadi("")
    setJumlahBenih("")
    setCatatan("")
    setErrors({})
    setResult(null)
    setShowResultModal(false)
  }

  const focusFirstError = (newErrors: FormErrors) => {
    if (newErrors.lahanId) {
      lahanRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
      lahanRef.current?.focus()
      return
    }

    if (newErrors.tanggalMulai) {
      tanggalRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
      tanggalRef.current?.focus()
      return
    }

    if (newErrors.varietasPadi) {
      varietasRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      })
      varietasRef.current?.focus()
      return
    }

    if (newErrors.jumlahBenih) {
      benihRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
      benihRef.current?.focus()
    }
  }

  const validateForm = () => {
    const newErrors: FormErrors = {}

    if (!lahanId) {
      newErrors.lahanId = "Lahan wajib dipilih."
    }

    if (!tanggalMulai) {
      newErrors.tanggalMulai = "Tanggal pindah tanam wajib diisi."
    } else if (tanggalMulai > today) {
      newErrors.tanggalMulai =
        "Tanggal pindah tanam out of range. Tanggal tidak boleh lebih dari hari ini."
    }

    if (!varietasPadi.trim()) {
      newErrors.varietasPadi = "Varietas padi wajib diisi."
    }

    if (!jumlahBenih) {
      newErrors.jumlahBenih = "Jumlah benih wajib diisi."
    } else {
      const jumlahBenihNumber = parseFloat(jumlahBenih.replace(",", "."))

      if (isNaN(jumlahBenihNumber) || jumlahBenihNumber <= 0) {
        newErrors.jumlahBenih = "Jumlah benih harus berupa angka lebih dari 0."
      }
    }

    setErrors(newErrors)

    if (Object.keys(newErrors).length > 0) {
      setTimeout(() => focusFirstError(newErrors), 100)
      return false
    }

    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!user || user.role !== "pengelola") {
      alert("Hanya pengelola yang boleh mulai tanam.")
      return
    }

    const isValid = validateForm()

    if (!isValid) {
      return
    }

    const selectedLahan = lahanList.find((lahan) => lahan.id === lahanId)

    if (!selectedLahan) {
      alert("Lahan tidak ditemukan atau belum siap tanam.")
      return
    }

    setLoading(true)

    const { data: latestLahan, error: latestLahanError } = await supabase
      .from("lahan")
      .select("id, status")
      .eq("id", lahanId)
      .single()

    if (
      latestLahanError ||
      !latestLahan ||
      latestLahan.status !== "siap_tanam_kembali"
    ) {
      console.log("LATEST LAHAN ERROR:", latestLahanError)
      alert("Lahan ini tidak bisa mulai tanam karena statusnya belum siap tanam.")
      setLoading(false)
      return
    }

    const jumlahBenihNumber = parseFloat(jumlahBenih.replace(",", "."))

    const panenMulai = addDays(tanggalMulai, 80)
    const panenSelesai = addDays(tanggalMulai, 105)
    const siapTanamKembali = addDays(tanggalMulai, 120)

    const estimasiGabahMin = jumlahBenihNumber * 150
    const estimasiGabahMax = jumlahBenihNumber * 250

    const timeline = buildTimeline(tanggalMulai)

    const { data: jadwalTanam, error: jadwalError } = await supabase
      .from("jadwal_tanam")
      .insert([
        {
          lahan_id: lahanId,
          tanggal_mulai: tanggalMulai,
          tanggal_selesai: panenSelesai,
          status: "masa_tanam_aktif",
          varietas_padi: varietasPadi.trim(),
          jumlah_benih: jumlahBenihNumber,
          catatan: catatan.trim() || null,
          timeline_overrides: {},
        },
      ])
      .select()

    if (jadwalError || !jadwalTanam) {
      console.log("JADWAL TANAM ERROR:", jadwalError)
      alert("Gagal menyimpan data mulai tanam. Cek console browser.")
      setLoading(false)
      return
    }

    const { error: lahanError } = await supabase
      .from("lahan")
      .update({
        status: "masa_tanam_aktif",
      })
      .eq("id", lahanId)

    if (lahanError) {
      console.log("UPDATE LAHAN ERROR:", lahanError)
      alert("Jadwal tanam tersimpan, tapi gagal mengubah status lahan.")
      setLoading(false)
      return
    }

    const { error: logError } = await supabase.from("aktivitas_log").insert([
      {
        lahan_id: lahanId,
        pengelola_id: user.id,
        tanggal: tanggalMulai,
        jenis_aktivitas: "Mulai Tanam",
        deskripsi: catatan.trim() || "Musim tanam dimulai.",
        bukti: null,
      },
    ])

    if (logError) {
      console.log("LOG MULAI TANAM ERROR:", logError)
      alert("Jadwal tanam tersimpan, tapi gagal mencatat log mulai tanam.")
      setLoading(false)
      return
    }

    setResult({
      lokasi_lahan: selectedLahan.lokasi,
      tanggal_mulai: tanggalMulai,
      panen_mulai: panenMulai,
      panen_selesai: panenSelesai,
      siap_tanam_kembali: siapTanamKembali,
      varietas_padi: varietasPadi.trim(),
      jumlah_benih: jumlahBenihNumber,
      estimasi_gabah_min: estimasiGabahMin,
      estimasi_gabah_max: estimasiGabahMax,
      timeline,
    })

    setShowResultModal(true)
    setLoading(false)
  }

  const handleInputAgain = async () => {
    resetForm()
    await fetchLahan()
  }

  const handleExit = () => {
    resetForm()
    router.push("/dashboard")
  }

  if (checkingUser) {
    return (
      <main className="min-h-screen bg-gray-50 p-6 text-gray-900">
        Loading...
      </main>
    )
  }

  if (!user) {
    return null
  }

  const isPengelola = user.role === "pengelola"

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900">
      <div className="mx-auto w-full max-w-4xl px-4 py-4 md:px-6 md:py-6">
        <header className="mb-6 rounded-2xl border bg-white p-4 shadow-sm">
          <div>
            <p className="text-sm font-medium text-green-700">RiceShare</p>
            <h1 className="text-2xl font-bold">Mulai Tanam</h1>
          </div>
        </header>

        {!isPengelola && (
          <section className="mb-6 rounded-2xl border border-yellow-200 bg-yellow-50 p-4">
            <h2 className="font-semibold text-yellow-900">Mode Pemilik</h2>
            <p className="text-sm text-yellow-800">
              Pemilik hanya bisa melihat monitoring. Mulai tanam hanya dapat
              dilakukan oleh pengelola.
            </p>
          </section>
        )}

        {isPengelola && (
          <section className="rounded-2xl border bg-white p-5 shadow-sm">
            {lahanList.length === 0 && (
              <div className="mb-4 rounded-xl border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
                Belum ada lahan yang siap tanam.
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div>
                <label className="mb-1 block text-sm font-medium">
                  Pilih Lahan <span className="text-red-500">*</span>
                </label>

                <div className="relative">
                  <select
                    ref={lahanRef}
                    className={`w-full appearance-none rounded-xl border bg-white px-3 py-2 pr-10 outline-none focus:ring-2 ${
                      errors.lahanId
                        ? "border-red-500 bg-red-50 focus:ring-red-500"
                        : "focus:ring-green-500"
                    }`}
                    value={lahanId}
                    onChange={(e) => {
                      setLahanId(e.target.value)
                      setErrors((prev) => ({ ...prev, lahanId: undefined }))
                    }}
                  >
                    <option value="">Pilih lahan</option>

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

                {errors.lahanId && (
                  <p className="mt-1 text-sm text-red-600">
                    {errors.lahanId}
                  </p>
                )}
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  Tanggal Pindah Tanam / H0{" "}
                  <span className="text-red-500">*</span>
                </label>

                <input
                  ref={tanggalRef}
                  type="date"
                  max={today}
                  className={`w-full rounded-xl border px-3 py-2 outline-none focus:ring-2 ${
                    errors.tanggalMulai
                      ? "border-red-500 bg-red-50 focus:ring-red-500"
                      : "focus:ring-green-500"
                  }`}
                  value={tanggalMulai}
                  onChange={(e) => {
                    const value = e.target.value
                    setTanggalMulai(value)

                    if (value && value > today) {
                      setErrors((prev) => ({
                        ...prev,
                        tanggalMulai:
                          "Tanggal pindah tanam out of range. Tanggal tidak boleh lebih dari hari ini.",
                      }))
                    } else {
                      setErrors((prev) => ({
                        ...prev,
                        tanggalMulai: undefined,
                      }))
                    }
                  }}
                />

                {errors.tanggalMulai && (
                  <p className="mt-1 text-sm text-red-600">
                    {errors.tanggalMulai}
                  </p>
                )}
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  Varietas Padi <span className="text-red-500">*</span>
                </label>

                <input
                  ref={varietasRef}
                  type="text"
                  placeholder="Contoh: IR64, Ciherang, Inpari"
                  className={`w-full rounded-xl border px-3 py-2 outline-none focus:ring-2 ${
                    errors.varietasPadi
                      ? "border-red-500 bg-red-50 focus:ring-red-500"
                      : "focus:ring-green-500"
                  }`}
                  value={varietasPadi}
                  onChange={(e) => {
                    setVarietasPadi(e.target.value)
                    setErrors((prev) => ({
                      ...prev,
                      varietasPadi: undefined,
                    }))
                  }}
                />

                {errors.varietasPadi && (
                  <p className="mt-1 text-sm text-red-600">
                    {errors.varietasPadi}
                  </p>
                )}
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  Jumlah Benih/Bibit <span className="text-red-500">*</span>
                </label>

                <div
                  className={`flex overflow-hidden rounded-xl border focus-within:ring-2 ${
                    errors.jumlahBenih
                      ? "border-red-500 bg-red-50 focus-within:ring-red-500"
                      : "focus-within:ring-green-500"
                  }`}
                >
                  <input
                    ref={benihRef}
                    type="text"
                    inputMode="decimal"
                    placeholder="Masukkan jumlah benih"
                    className="w-full bg-transparent px-3 py-2 outline-none"
                    value={jumlahBenih}
                    onChange={(e) => {
                      const value = e.target.value

                      if (/^[0-9]*[.,]?[0-9]*$/.test(value)) {
                        setJumlahBenih(value)
                        setErrors((prev) => ({
                          ...prev,
                          jumlahBenih: undefined,
                        }))
                      }
                    }}
                  />

                  <span className="flex items-center border-l bg-gray-50 px-3 text-sm text-gray-500">
                    kg
                  </span>
                </div>

                {errors.jumlahBenih && (
                  <p className="mt-1 text-sm text-red-600">
                    {errors.jumlahBenih}
                  </p>
                )}
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  Catatan Awal
                </label>

                <textarea
                  placeholder="Masukkan catatan awal tanam"
                  className="min-h-24 w-full rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-green-500"
                  value={catatan}
                  onChange={(e) => setCatatan(e.target.value)}
                />
              </div>

              <div className="rounded-xl bg-green-50 p-4 text-sm text-green-800">
                Sistem akan menghitung estimasi panen dan siap tanam kembali
                dari tanggal pindah tanam.
              </div>

              <div className="flex flex-col gap-2 pt-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => router.push("/dashboard")}
                  className="w-full rounded-xl border px-4 py-2 font-medium hover:bg-gray-50 sm:w-1/2"
                >
                  Batal
                </button>

                <button
                  type="submit"
                  disabled={loading || lahanList.length === 0}
                  className="w-full rounded-xl bg-green-600 px-4 py-2 font-semibold text-white hover:bg-green-700 disabled:opacity-60 sm:w-1/2"
                >
                  {loading ? "Menyimpan..." : "Simpan"}
                </button>
              </div>
            </form>
          </section>
        )}
      </div>

      {showResultModal && result && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-4">
              <p className="text-sm font-medium text-green-700">
                Data berhasil disimpan
              </p>
              <h2 className="text-xl font-bold">Musim Tanam Dimulai</h2>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-xl bg-gray-50 p-3">
                <p className="text-sm text-gray-500">Lahan</p>
                <p className="font-bold">{result.lokasi_lahan}</p>
              </div>

              <div className="rounded-xl bg-gray-50 p-3">
                <p className="text-sm text-gray-500">Tanggal Pindah Tanam</p>
                <p className="font-bold">
                  {formatDateId(result.tanggal_mulai)}
                </p>
              </div>

              <div className="rounded-xl bg-gray-50 p-3">
                <p className="text-sm text-gray-500">Estimasi Panen</p>
                <p className="font-bold">
                  {formatDateId(result.panen_mulai)} -{" "}
                  {formatDateId(result.panen_selesai)}
                </p>
              </div>

              <div className="rounded-xl bg-gray-50 p-3">
                <p className="text-sm text-gray-500">Siap Tanam Kembali</p>
                <p className="font-bold">
                  {formatDateId(result.siap_tanam_kembali)}
                </p>
              </div>

              <div className="rounded-xl bg-gray-50 p-3">
                <p className="text-sm text-gray-500">Varietas</p>
                <p className="font-bold">{result.varietas_padi}</p>
              </div>

              <div className="rounded-xl bg-gray-50 p-3">
                <p className="text-sm text-gray-500">Jumlah Benih</p>
                <p className="font-bold">
                  {formatNumber(result.jumlah_benih)} kg
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-green-100 bg-green-50 p-4">
              <p className="text-sm text-green-700">Estimasi Hasil Gabah</p>
              <p className="text-lg font-bold text-green-900">
                {formatNumber(result.estimasi_gabah_min)} -{" "}
                {formatNumber(result.estimasi_gabah_max)} kg
              </p>
            </div>

            <div className="mt-4">
              <h3 className="mb-3 font-bold">Timeline Siklus Tanam</h3>

              <div className="space-y-2">
                {result.timeline.map((item) => (
                  <div
                    key={item.label}
                    className="rounded-xl border bg-gray-50 p-3"
                  >
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-semibold">{item.label}</p>
                        <p className="text-sm text-gray-500">{item.tanggal}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <button
                onClick={handleExit}
                className="w-full rounded-xl border px-4 py-2 font-medium hover:bg-gray-50 sm:w-1/2"
              >
                Exit
              </button>

              <button
                onClick={handleInputAgain}
                className="w-full rounded-xl bg-green-600 px-4 py-2 font-semibold text-white hover:bg-green-700 sm:w-1/2"
              >
                Input Lagi
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}