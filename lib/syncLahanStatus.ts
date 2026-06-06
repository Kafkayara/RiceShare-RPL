import { supabase } from "@/lib/supabase"

type LahanStatus =
  | "belum_digunakan"
  | "masa_tanam_aktif"
  | "menjelang_panen"
  | "panen_selesai"
  | "istirahat"
  | "siap_tanam_kembali"

type TimelineOverrides = Record<string, string>

type JadwalTanam = {
  id: string
  lahan_id: string
  tanggal_mulai: string
  tanggal_selesai: string | null
  status: string
  created_at: string | null
  timeline_overrides?: TimelineOverrides | null
}

type Lahan = {
  id: string
  status: LahanStatus
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

function getTimelineDate(
  tanggalMulai: string,
  overrides: TimelineOverrides | null | undefined,
  key: string,
  fallbackOffset: number
) {
  if (overrides?.[key]) {
    return overrides[key]
  }

  return addDays(tanggalMulai, fallbackOffset)
}

function getTargetStatus(
  currentStatus: LahanStatus,
  tanggalMulai: string,
  overrides: TimelineOverrides | null | undefined,
  panenTanggal: string | null   // tanggal panen aktual dari tabel panen
): LahanStatus {
  const today = getTodayDateInputValue()

  const mulaiMenjelangPanen = getTimelineDate(
    tanggalMulai, overrides, "menjelang_panen", 70
  )

  const akhirPanenEstimasi = getTimelineDate(
    tanggalMulai, overrides, "panen_estimasi", 105
  )

  // Masa istirahat mulai 7 hari setelah panen aktual (atau akhir estimasi)
  const acuanPanen = panenTanggal || akhirPanenEstimasi
  const mulaiIstirahat = getTimelineDate(
    acuanPanen, overrides, "masa_istirahat", 7
  )

  // Siap tanam kembali: 21 hari setelah mulai istirahat
  const siapTanamKembali = getTimelineDate(
    mulaiIstirahat, overrides, "siap_tanam_kembali", 21
  )

  // 1. Sudah lewat masa istirahat → siap tanam kembali
  if (today >= siapTanamKembali) {
    return "siap_tanam_kembali"
  }

  // 2. Panen selesai → langsung masuk istirahat setelah 7 hari
  if (currentStatus === "panen_selesai") {
    if (today >= mulaiIstirahat) return "istirahat"
    // Belum 7 hari pasca panen, tetap panen_selesai
    return "panen_selesai"
  }

  // 3. Sedang istirahat → tunggu siapTanamKembali (sudah ditangani di atas)
  if (currentStatus === "istirahat") {
    return "istirahat"
  }

  // 4. Sedang masa tanam aktif atau menjelang panen
  const statusAktif: LahanStatus[] = [
    "masa_tanam_aktif", "menjelang_panen"
  ]

  if (statusAktif.includes(currentStatus)) {
    if (today >= mulaiMenjelangPanen && today <= akhirPanenEstimasi) {
      return "menjelang_panen"
    }
    if (today < mulaiMenjelangPanen) {
      return "masa_tanam_aktif"
    }
    // Sudah lewat estimasi panen tapi belum ada record panen
    // Tetap di menjelang_panen agar pengelola ingat input panen
    return "menjelang_panen"
  }

  return currentStatus
}

export async function syncLahanStatus() {
  const { data: lahanList, error: lahanError } = await supabase
    .from("lahan")
    .select("id, status")

  if (lahanError) {
    console.log("SYNC FETCH LAHAN ERROR:", lahanError)
    return
  }

  const { data: jadwalList, error: jadwalError } = await supabase
    .from("jadwal_tanam")
    .select(`
      id,
      lahan_id,
      tanggal_mulai,
      tanggal_selesai,
      status,
      created_at,
      timeline_overrides
    `)
    .order("created_at", { ascending: false })

  if (jadwalError) {
    console.log("SYNC FETCH JADWAL ERROR:", jadwalError)
    return
  }

  // Ambil tanggal panen aktual terbaru per lahan
  const { data: panenList } = await supabase
    .from("panen")
    .select("lahan_id, tanggal")
    .order("tanggal", { ascending: false })

  const latestPanenByLahan = new Map<string, string>()
  ;(panenList || []).forEach((p: { lahan_id: string; tanggal: string }) => {
    if (!latestPanenByLahan.has(p.lahan_id)) {
      latestPanenByLahan.set(p.lahan_id, p.tanggal)
    }
  })

  const latestJadwalByLahan = new Map<string, JadwalTanam>()
  ;(jadwalList || []).forEach((jadwal) => {
    if (!latestJadwalByLahan.has(jadwal.lahan_id)) {
      latestJadwalByLahan.set(jadwal.lahan_id, jadwal)
    }
  })

  for (const lahan of lahanList || []) {
    const jadwal = latestJadwalByLahan.get(lahan.id)

    if (!jadwal?.tanggal_mulai) continue

    const currentStatus = lahan.status as LahanStatus

    if (currentStatus === "belum_digunakan") continue

    // Tanggal panen aktual jika sudah ada record panen
    const panenTanggal = latestPanenByLahan.get(lahan.id) || null

    const targetStatus = getTargetStatus(
      currentStatus,
      jadwal.tanggal_mulai,
      jadwal.timeline_overrides || {},
      panenTanggal
    )

    if (targetStatus === currentStatus) continue

    const { error: updateLahanError } = await supabase
      .from("lahan")
      .update({ status: targetStatus })
      .eq("id", lahan.id)

    if (updateLahanError) {
      console.log("SYNC UPDATE LAHAN ERROR:", updateLahanError)
      continue
    }

    const { error: updateJadwalError } = await supabase
      .from("jadwal_tanam")
      .update({ status: targetStatus })
      .eq("id", jadwal.id)

    if (updateJadwalError) {
      console.log("SYNC UPDATE JADWAL ERROR:", updateJadwalError)
    }
  }
}