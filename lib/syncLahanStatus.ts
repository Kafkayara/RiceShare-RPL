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
  overrides: TimelineOverrides | null | undefined
): LahanStatus {
  const today = getTodayDateInputValue()

  const mulaiMenjelangPanen = getTimelineDate(
    tanggalMulai,
    overrides,
    "menjelang_panen",
    70
  )

  const akhirPanenEstimasi = getTimelineDate(
    tanggalMulai,
    overrides,
    "panen_estimasi",
    105
  )

  const mulaiIstirahat = getTimelineDate(
    tanggalMulai,
    overrides,
    "masa_istirahat",
    119
  )

  const siapTanamKembali = getTimelineDate(
    tanggalMulai,
    overrides,
    "siap_tanam_kembali",
    120
  )

  if (today >= siapTanamKembali) {
    return "siap_tanam_kembali"
  }

  if (
    currentStatus === "panen_selesai" &&
    today > akhirPanenEstimasi &&
    today < siapTanamKembali
  ) {
    return "istirahat"
  }

  if (
    today >= mulaiMenjelangPanen &&
    today <= akhirPanenEstimasi &&
    currentStatus !== "panen_selesai" &&
    currentStatus !== "istirahat" &&
    currentStatus !== "siap_tanam_kembali"
  ) {
    return "menjelang_panen"
  }

  if (
    today < mulaiMenjelangPanen &&
    currentStatus !== "panen_selesai" &&
    currentStatus !== "istirahat" &&
    currentStatus !== "siap_tanam_kembali"
  ) {
    return "masa_tanam_aktif"
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

  const latestJadwalByLahan = new Map<string, JadwalTanam>()

  ;(jadwalList || []).forEach((jadwal) => {
    if (!latestJadwalByLahan.has(jadwal.lahan_id)) {
      latestJadwalByLahan.set(jadwal.lahan_id, jadwal)
    }
  })

  for (const lahan of lahanList || []) {
    const jadwal = latestJadwalByLahan.get(lahan.id)

    if (!jadwal?.tanggal_mulai) {
      continue
    }

    const currentStatus = lahan.status as LahanStatus

    if (currentStatus === "belum_digunakan") {
      continue
    }

    const targetStatus = getTargetStatus(
      currentStatus,
      jadwal.tanggal_mulai,
      jadwal.timeline_overrides || {}
    )

    if (targetStatus === currentStatus) {
      continue
    }

    const { error: updateLahanError } = await supabase
      .from("lahan")
      .update({
        status: targetStatus,
      })
      .eq("id", lahan.id)

    if (updateLahanError) {
      console.log("SYNC UPDATE LAHAN ERROR:", updateLahanError)
      continue
    }

    const { error: updateJadwalError } = await supabase
      .from("jadwal_tanam")
      .update({
        status: targetStatus,
      })
      .eq("id", jadwal.id)

    if (updateJadwalError) {
      console.log("SYNC UPDATE JADWAL ERROR:", updateJadwalError)
    }
  }
}