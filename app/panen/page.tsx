"use client"
export const dynamic = "force-dynamic"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

type UserProfile = {
  id: string
  nama: string
  email: string
  role: "pemilik" | "pengelola"
}

type FormErrors = {
  lahanId?: string
  tanggal?: string
  berat?: string
}

type ResultData = {
  total_gkp: number
  total_beras: number
  porsi_pemilik: number
  porsi_pengelola: number
  bukti_url: string | null
}

type Lahan = {
  id: string
  lokasi: string
  luas: number
  status: string
}

const allowedPanenStatuses = ["masa_tanam_aktif", "menjelang_panen"]

function getTodayDateInputValue() {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, "0")
  const day = String(today.getDate()).padStart(2, "0")

  return `${year}-${month}-${day}`
}

function formatKg(value: number) {
  return new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value)
}

export default function PanenPage() {
  const router = useRouter()

  const [user, setUser] = useState<UserProfile | null>(null)
  const [checkingUser, setCheckingUser] = useState(true)

  const [lahanId, setLahanId] = useState("")
  const [berat, setBerat] = useState("")
  const [tanggal, setTanggal] = useState("")
  const [catatan, setCatatan] = useState("")
  const [buktiFile, setBuktiFile] = useState<File | null>(null)
  const [fileInputKey, setFileInputKey] = useState(0)

  const [errors, setErrors] = useState<FormErrors>({})
  const [result, setResult] = useState<ResultData | null>(null)
  const [showResultModal, setShowResultModal] = useState(false)

  const [lahanList, setLahanList] = useState<Lahan[]>([])
  const [loading, setLoading] = useState(false)

  const lahanRef = useRef<HTMLSelectElement | null>(null)
  const tanggalRef = useRef<HTMLInputElement | null>(null)
  const beratRef = useRef<HTMLInputElement | null>(null)

  const today = getTodayDateInputValue()

  const fetchLahan = async () => {
    const { data, error } = await supabase
      .from("lahan")
      .select("id, lokasi, luas, status")
      .in("status", allowedPanenStatuses)
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]

    if (!file) {
      setBuktiFile(null)
      return
    }

    const allowedTypes = ["image/png", "image/jpeg", "image/jpg"]

    if (!allowedTypes.includes(file.type)) {
      alert("File bukti harus berupa PNG atau JPG.")
      e.target.value = ""
      setBuktiFile(null)
      return
    }

    const maxSize = 5 * 1024 * 1024

    if (file.size > maxSize) {
      alert("Ukuran file maksimal 5MB.")
      e.target.value = ""
      setBuktiFile(null)
      return
    }

    setBuktiFile(file)
  }

  const resetForm = () => {
    setLahanId("")
    setBerat("")
    setTanggal("")
    setCatatan("")
    setBuktiFile(null)
    setErrors({})
    setResult(null)
    setShowResultModal(false)

    setFileInputKey((prev) => prev + 1)
  }

  const focusFirstError = (newErrors: FormErrors) => {
    if (newErrors.lahanId) {
      lahanRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
      lahanRef.current?.focus()
      return
    }

    if (newErrors.tanggal) {
      tanggalRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
      tanggalRef.current?.focus()
      return
    }

    if (newErrors.berat) {
      beratRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
      beratRef.current?.focus()
    }
  }

  const validateForm = () => {
    const newErrors: FormErrors = {}

    if (!lahanId) {
      newErrors.lahanId = "Lahan wajib dipilih."
    }

    if (!tanggal) {
      newErrors.tanggal = "Tanggal panen wajib diisi."
    } else if (tanggal > today) {
      newErrors.tanggal =
        "Tanggal panen out of range. Tanggal tidak boleh lebih dari hari ini."
    }

    if (!berat) {
      newErrors.berat = "Total Gabah / GKP wajib diisi."
    } else {
      const beratNumber = parseFloat(berat.replace(",", "."))

      if (isNaN(beratNumber) || beratNumber <= 0) {
        newErrors.berat = "Berat GKP harus berupa angka lebih dari 0."
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
      alert("Hanya pengelola yang boleh input panen.")
      return
    }

    const isValid = validateForm()

    if (!isValid) {
      return
    }

    const selectedLahan = lahanList.find((lahan) => lahan.id === lahanId)

    if (!selectedLahan) {
      alert("Lahan tidak ditemukan atau tidak siap panen.")
      return
    }

    const beratNumber = parseFloat(berat.replace(",", "."))

    setLoading(true)

    const { data: latestLahan, error: latestLahanError } = await supabase
      .from("lahan")
      .select("id, status")
      .eq("id", lahanId)
      .single()

    if (
      latestLahanError ||
      !latestLahan ||
      !allowedPanenStatuses.includes(latestLahan.status)
    ) {
      console.log("LATEST LAHAN ERROR:", latestLahanError)
      alert(
        "Lahan ini tidak bisa dipanen karena statusnya bukan masa tanam aktif atau menjelang panen."
      )
      setLoading(false)
      return
    }

    let buktiUrl: string | null = null

    if (buktiFile) {
      const fileExt = buktiFile.name.split(".").pop()
      const fileName = `${Date.now()}-${Math.random()
        .toString(36)
        .substring(2)}.${fileExt}`

      const filePath = `panen/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from("bukti-panen")
        .upload(filePath, buktiFile)

      if (uploadError) {
        console.log("UPLOAD BUKTI ERROR:", uploadError)
        alert("Gagal upload bukti panen.")
        setLoading(false)
        return
      }

      const { data: publicUrlData } = supabase.storage
        .from("bukti-panen")
        .getPublicUrl(filePath)

      buktiUrl = publicUrlData.publicUrl
    }

    const { data: panen, error: panenError } = await supabase
      .from("panen")
      .insert([
        {
          lahan_id: lahanId,
          berat_gkp: beratNumber,
          tanggal: tanggal,
          catatan: catatan || null,
          bukti_url: buktiUrl,
        },
      ])
      .select()

    if (panenError || !panen) {
      console.log("PANEN ERROR:", panenError)
      alert("Gagal menyimpan data panen.")
      setLoading(false)
      return
    }

    const panenId = panen[0]?.id

    const totalBeras = beratNumber * 0.65
    const porsiPemilik = totalBeras * 0.5
    const porsiPengelola = totalBeras * 0.5

    const { error: bagiHasilError } = await supabase
      .from("bagi_hasil")
      .insert([
        {
          panen_id: panenId,
          total_beras: totalBeras,
          porsi_pemilik: porsiPemilik,
          porsi_pengelola: porsiPengelola,
        },
      ])

    if (bagiHasilError) {
      console.log("BAGI HASIL ERROR:", bagiHasilError)
      alert("Panen tersimpan, tapi gagal menyimpan bagi hasil.")
      setLoading(false)
      return
    }

    const { error: updateLahanError } = await supabase
      .from("lahan")
      .update({
        status: "panen_selesai",
      })
      .eq("id", lahanId)

    if (updateLahanError) {
      console.log("UPDATE LAHAN ERROR:", updateLahanError)
      alert("Panen tersimpan, tapi gagal mengubah status lahan.")
      setLoading(false)
      return
    }

    setResult({
      total_gkp: beratNumber,
      total_beras: totalBeras,
      porsi_pemilik: porsiPemilik,
      porsi_pengelola: porsiPengelola,
      bukti_url: buktiUrl,
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
            <h1 className="text-2xl font-bold">Input Panen</h1>
          </div>
        </header>

        {!isPengelola && (
          <section className="mb-6 rounded-2xl border border-yellow-200 bg-yellow-50 p-4">
            <h2 className="font-semibold text-yellow-900">Mode Pemilik</h2>
            <p className="text-sm text-yellow-800">
              Pemilik hanya bisa melihat hasil monitoring dan laporan. Input
              panen hanya dapat dilakukan oleh pengelola.
            </p>
          </section>
        )}

        {isPengelola && (
          <section className="rounded-2xl border bg-white p-5 shadow-sm">

            {lahanList.length === 0 && (
              <div className="mb-4 rounded-xl border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
                Belum ada lahan yang bisa dipanen.
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
                  Tanggal Panen <span className="text-red-500">*</span>
                </label>

                <input
                  ref={tanggalRef}
                  type="date"
                  max={today}
                  className={`w-full rounded-xl border px-3 py-2 outline-none focus:ring-2 ${
                    errors.tanggal
                      ? "border-red-500 bg-red-50 focus:ring-red-500"
                      : "focus:ring-green-500"
                  }`}
                  value={tanggal}
                  onChange={(e) => {
                    const value = e.target.value
                    setTanggal(value)

                    if (value && value > today) {
                      setErrors((prev) => ({
                        ...prev,
                        tanggal:
                          "Tanggal panen out of range. Tanggal tidak boleh lebih dari hari ini.",
                      }))
                    } else {
                      setErrors((prev) => ({ ...prev, tanggal: undefined }))
                    }
                  }}
                />

                {errors.tanggal && (
                  <p className="mt-1 text-sm text-red-600">
                    {errors.tanggal}
                  </p>
                )}
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  Total Gabah / GKP <span className="text-red-500">*</span>
                </label>

                <div
                  className={`flex overflow-hidden rounded-xl border focus-within:ring-2 ${
                    errors.berat
                      ? "border-red-500 bg-red-50 focus-within:ring-red-500"
                      : "focus-within:ring-green-500"
                  }`}
                >
                  <input
                    ref={beratRef}
                    type="text"
                    inputMode="decimal"
                    placeholder="Masukkan berat"
                    className="w-full bg-transparent px-3 py-2 outline-none"
                    value={berat}
                    onChange={(e) => {
                      const value = e.target.value

                      if (/^[0-9]*[.,]?[0-9]*$/.test(value)) {
                        setBerat(value)
                        setErrors((prev) => ({ ...prev, berat: undefined }))
                      }
                    }}
                  />

                  <span className="flex items-center border-l bg-gray-50 px-3 text-sm text-gray-500">
                    kg
                  </span>
                </div>

                {errors.berat && (
                  <p className="mt-1 text-sm text-red-600">{errors.berat}</p>
                )}
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  Catatan
                </label>

                <textarea
                  placeholder="Masukkan catatan panen"
                  className="min-h-24 w-full rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-green-500"
                  value={catatan}
                  onChange={(e) => setCatatan(e.target.value)}
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  Upload Bukti
                </label>

                <input
                  key={fileInputKey}
                  id="bukti-file"
                  type="file"
                  accept="image/png,image/jpeg,image/jpg"
                  className="w-full rounded-xl border bg-white px-3 py-2 text-sm"
                  onChange={handleFileChange}
                />

                <p className="mt-1 text-xs text-gray-500">
                  Format: JPG atau PNG. Maksimal 5MB.
                </p>

                {buktiFile && (
                  <p className="mt-2 text-xs text-green-700">
                    File dipilih: {buktiFile.name}
                  </p>
                )}
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
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-4">
              <p className="text-sm font-medium text-green-700">
                Data berhasil disimpan
              </p>
              <h2 className="text-xl font-bold">
                Hasil Panen & Bagi Hasil
              </h2>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-xl bg-gray-50 p-3">
                <span>Total GKP</span>
                <strong>{formatKg(result.total_gkp)} kg</strong>
              </div>

              <div className="flex items-center justify-between rounded-xl bg-gray-50 p-3">
                <span>Hasil Beras Estimasi</span>
                <strong>{formatKg(result.total_beras)} kg</strong>
              </div>

              <div className="rounded-xl border border-blue-100 bg-blue-50 p-3">
                <div className="flex items-center justify-between gap-4">
                  <span>Bagian Pemilik 50%</span>
                  <strong className="text-blue-700">
                    {formatKg(result.porsi_pemilik)} kg
                  </strong>
                </div>
              </div>

              <div className="rounded-xl border border-yellow-100 bg-yellow-50 p-3">
                <div className="flex items-center justify-between gap-4">
                  <span>Bagian Pengelola 50%</span>
                  <strong className="text-yellow-700">
                    {formatKg(result.porsi_pengelola)} kg
                  </strong>
                </div>
              </div>

              {result.bukti_url && (
                <a
                  href={result.bukti_url}
                  target="_blank"
                  className="inline-block text-sm font-medium text-green-700 hover:underline"
                >
                  Lihat bukti panen
                </a>
              )}
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