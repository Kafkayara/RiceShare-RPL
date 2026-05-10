"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

type UserProfile = {
  id: string
  nama: string
  email: string
  role: "pemilik" | "pengelola"
}

type PengelolaItem = {
  id: string
  nama: string
  email: string
  no_hp: string | null
  role: string
  status_akun: "aktif" | "nonaktif"
  catatan: string | null
}

type FormState = {
  nama: string
  email: string
  no_hp: string
  kata_sandi: string
  status_akun: "aktif" | "nonaktif"
  catatan: string
}

const emptyForm: FormState = {
  nama: "",
  email: "",
  no_hp: "",
  kata_sandi: "",
  status_akun: "aktif",
  catatan: "",
}

export default function PengelolaPage() {
  const router = useRouter()

  const [user, setUser] = useState<UserProfile | null>(null)
  const [pengelolaList, setPengelolaList] = useState<PengelolaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")

  // Modal state
  const [showModal, setShowModal] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Delete confirmation
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // Freeze confirmation
  const [freezingId, setFreezingId] = useState<string | null>(null)
  const [freezingCurrentStatus, setFreezingCurrentStatus] = useState<"aktif" | "nonaktif">("aktif")
  const [showFreezeConfirm, setShowFreezeConfirm] = useState(false)

  useEffect(() => {
    const savedUser = localStorage.getItem("riceshare_user")

    if (!savedUser) {
      router.push("/")
      return
    }

    const parsedUser = JSON.parse(savedUser) as UserProfile

    // Hanya pemilik yang boleh akses halaman ini
    if (parsedUser.role !== "pemilik") {
      router.push("/dashboard")
      return
    }

    setUser(parsedUser)
  }, [router])

  const fetchPengelola = async () => {
    setLoading(true)

    const { data, error } = await supabase
      .from("users")
      .select("id, nama, email, no_hp, role, status_akun, catatan")
      .eq("role", "pengelola")
      .order("nama", { ascending: true })

    if (error) {
      console.log("FETCH PENGELOLA ERROR:", error)
    }

    setPengelolaList((data || []) as PengelolaItem[])
    setLoading(false)
  }

  useEffect(() => {
    if (user) {
      fetchPengelola()
    }
  }, [user])

  const filteredPengelola = pengelolaList.filter((p) =>
    p.nama.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.email.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // ─── Tambah Pengelola ───────────────────────────────────────────────────────
  const handleTambah = () => {
    setIsEditing(false)
    setEditingId(null)
    setForm(emptyForm)
    setFormError(null)
    setShowModal(true)
  }

  // ─── Edit Pengelola ─────────────────────────────────────────────────────────
  const handleEdit = (pengelola: PengelolaItem) => {
    setIsEditing(true)
    setEditingId(pengelola.id)
    setForm({
      nama: pengelola.nama,
      email: pengelola.email,
      no_hp: pengelola.no_hp || "",
      kata_sandi: "",
      status_akun: pengelola.status_akun,
      catatan: pengelola.catatan || "",
    })
    setFormError(null)
    setShowModal(true)
  }

  // ─── Submit Form (Tambah / Edit) ────────────────────────────────────────────
  const handleSubmit = async () => {
    setFormError(null)

    if (!form.nama.trim()) {
      setFormError("Nama lengkap wajib diisi.")
      return
    }

    if (!form.email.trim()) {
      setFormError("Email wajib diisi.")
      return
    }

    if (!isEditing && !form.kata_sandi.trim()) {
      setFormError("Kata sandi wajib diisi untuk pengelola baru.")
      return
    }

    setSubmitting(true)

    if (isEditing && editingId) {
      // Update data existing pengelola
      const updatePayload: Record<string, string> = {
        nama: form.nama.trim(),
        email: form.email.trim(),
        no_hp: form.no_hp.trim(),
        status_akun: form.status_akun,
        catatan: form.catatan.trim(),
      }

      if (form.kata_sandi.trim()) {
        updatePayload.kata_sandi = form.kata_sandi.trim()
      }

      const { error } = await supabase
        .from("users")
        .update(updatePayload)
        .eq("id", editingId)

      if (error) {
        setFormError("Gagal menyimpan perubahan. Coba lagi.")
        setSubmitting(false)
        return
      }
    } else {
      // Cek apakah email sudah terdaftar
      const { data: existingUser } = await supabase
        .from("users")
        .select("id")
        .eq("email", form.email.trim())
        .maybeSingle()

      if (existingUser) {
        setFormError("Email sudah terdaftar di sistem.")
        setSubmitting(false)
        return
      }

      // Insert pengelola baru
      const { error } = await supabase.from("users").insert({
        nama: form.nama.trim(),
        email: form.email.trim(),
        no_hp: form.no_hp.trim() || null,
        kata_sandi: form.kata_sandi.trim(),
        role: "pengelola",
        status_akun: form.status_akun,
        catatan: form.catatan.trim() || null,
      })

      if (error) {
        setFormError("Gagal menambahkan pengelola. Coba lagi.")
        setSubmitting(false)
        return
      }
    }

    setSubmitting(false)
    setShowModal(false)
    setForm(emptyForm)
    setEditingId(null)
    fetchPengelola()
  }

  // ─── Bekukan / Aktifkan ─────────────────────────────────────────────────────
  const handleFreezeClick = (pengelola: PengelolaItem) => {
    setFreezingId(pengelola.id)
    setFreezingCurrentStatus(pengelola.status_akun)
    setShowFreezeConfirm(true)
  }

  const handleFreezeConfirm = async () => {
    if (!freezingId) return

    const newStatus = freezingCurrentStatus === "aktif" ? "nonaktif" : "aktif"

    const { error } = await supabase
      .from("users")
      .update({ status_akun: newStatus })
      .eq("id", freezingId)

    if (error) {
      console.log("FREEZE ERROR:", error)
    }

    setShowFreezeConfirm(false)
    setFreezingId(null)
    fetchPengelola()
  }

  // ─── Hapus ──────────────────────────────────────────────────────────────────
  const handleDeleteClick = (id: string) => {
    setDeletingId(id)
    setShowDeleteConfirm(true)
  }

  const handleDeleteConfirm = async () => {
    if (!deletingId) return

    const { error } = await supabase
      .from("users")
      .delete()
      .eq("id", deletingId)

    if (error) {
      console.log("DELETE ERROR:", error)
    }

    setShowDeleteConfirm(false)
    setDeletingId(null)
    fetchPengelola()
  }

  if (!user) return null

  const deletingPengelola = pengelolaList.find((p) => p.id === deletingId)
  const freezingPengelola = pengelolaList.find((p) => p.id === freezingId)

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900">
      <div className="mx-auto w-full max-w-6xl px-4 py-4 md:px-6 md:py-6">

        {/* ── Header ── */}
        <header className="mb-6 flex flex-col gap-4 rounded-2xl border bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium text-green-700">RiceShare</p>
            <h1 className="text-2xl font-bold">Manajemen Pengelola</h1>
            <p className="text-sm text-gray-500">
              Kelola akun pengelola: tambah, edit, bekukan/aktifkan, atau hapus akun.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              onClick={() => router.push("/dashboard")}
              className="rounded-xl border px-4 py-2 text-sm font-medium hover:bg-gray-50"
            >
              ← Dashboard
            </button>

            <button
              onClick={handleTambah}
              className="rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
            >
              + Tambah Pengelola
            </button>
          </div>
        </header>

        {/* ── Catatan Info ── */}
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-700">
          <span className="mt-0.5">ℹ️</span>
          <p>
            Kelola akun pengelola: tambah, edit data, bekukan/aktifkan atau hapus akun.
            Pengelola dengan status <strong>Nonaktif</strong> tidak dapat login ke sistem.
          </p>
        </div>

        {/* ── Search ── */}
        <div className="mb-4">
          <input
            type="text"
            placeholder="🔍 Cari pengelola..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border bg-white px-4 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        {/* ── Tabel Daftar Pengelola ── */}
        {loading ? (
          <section className="rounded-2xl border bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">Memuat data pengelola...</p>
          </section>
        ) : filteredPengelola.length === 0 ? (
          <section className="rounded-2xl border bg-white p-5 shadow-sm">
            <p className="text-sm text-gray-500">
              {searchQuery
                ? `Tidak ada pengelola dengan nama atau email "${searchQuery}".`
                : "Belum ada pengelola terdaftar. Klik '+ Tambah Pengelola' untuk menambahkan."}
            </p>
          </section>
        ) : (
          <section className="rounded-2xl border bg-white shadow-sm">
            {/* Desktop table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50 text-left">
                    <th className="px-5 py-3 font-semibold text-gray-600">Nama Pengelola</th>
                    <th className="px-5 py-3 font-semibold text-gray-600">Peran</th>
                    <th className="px-5 py-3 font-semibold text-gray-600">Status</th>
                    <th className="px-5 py-3 font-semibold text-gray-600">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredPengelola.map((pengelola) => (
                    <tr key={pengelola.id} className="hover:bg-gray-50">
                      <td className="px-5 py-4">
                        <p className="font-semibold">{pengelola.nama}</p>
                        <p className="text-xs text-gray-500">{pengelola.email}</p>
                        {pengelola.no_hp && (
                          <p className="text-xs text-gray-500">{pengelola.no_hp}</p>
                        )}
                      </td>
                      <td className="px-5 py-4 capitalize text-gray-700">
                        Pengelola
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                            pengelola.status_akun === "aktif"
                              ? "border-green-200 bg-green-50 text-green-700"
                              : "border-gray-200 bg-gray-100 text-gray-500"
                          }`}
                        >
                          {pengelola.status_akun === "aktif" ? "Aktif" : "Nonaktif"}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          {/* Edit */}
                          <button
                            onClick={() => handleEdit(pengelola)}
                            title="Edit"
                            className="rounded-lg border p-2 text-gray-600 hover:bg-gray-100"
                          >
                            ✎
                          </button>

                          {/* Bekukan / Aktifkan */}
                          <button
                            onClick={() => handleFreezeClick(pengelola)}
                            title={pengelola.status_akun === "aktif" ? "Bekukan akun" : "Aktifkan akun"}
                            className={`rounded-lg border p-2 text-sm hover:bg-gray-100 ${
                              pengelola.status_akun === "aktif"
                                ? "text-yellow-600"
                                : "text-blue-600"
                            }`}
                          >
                            {pengelola.status_akun === "aktif" ? "⊘" : "○"}
                          </button>

                          {/* Hapus */}
                          <button
                            onClick={() => handleDeleteClick(pengelola.id)}
                            title="Hapus akun"
                            className="rounded-lg border p-2 text-red-500 hover:bg-red-50"
                          >
                            🗑
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile card list */}
            <div className="divide-y md:hidden">
              {filteredPengelola.map((pengelola) => (
                <div key={pengelola.id} className="p-4">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold">{pengelola.nama}</p>
                      <p className="text-xs text-gray-500">{pengelola.email}</p>
                      {pengelola.no_hp && (
                        <p className="text-xs text-gray-500">{pengelola.no_hp}</p>
                      )}
                    </div>
                    <span
                      className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold ${
                        pengelola.status_akun === "aktif"
                          ? "border-green-200 bg-green-50 text-green-700"
                          : "border-gray-200 bg-gray-100 text-gray-500"
                      }`}
                    >
                      {pengelola.status_akun === "aktif" ? "Aktif" : "Nonaktif"}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(pengelola)}
                      className="flex-1 rounded-xl border py-2 text-sm font-medium hover:bg-gray-50"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleFreezeClick(pengelola)}
                      className="flex-1 rounded-xl border py-2 text-sm font-medium hover:bg-gray-50"
                    >
                      {pengelola.status_akun === "aktif" ? "Bekukan" : "Aktifkan"}
                    </button>
                    <button
                      onClick={() => handleDeleteClick(pengelola.id)}
                      className="rounded-xl border px-3 py-2 text-sm text-red-500 hover:bg-red-50"
                    >
                      🗑
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════
          MODAL: Tambah / Edit Pengelola
      ══════════════════════════════════════════════════════ */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="mb-5 text-xl font-bold">
              {isEditing ? "Edit Pengelola" : "Tambah / Edit Pengelola"}
            </h2>

            <div className="space-y-4">
              {/* Nama */}
              <div>
                <label className="mb-1 block text-sm font-semibold text-gray-700">
                  Nama Lengkap
                </label>
                <input
                  type="text"
                  value={form.nama}
                  onChange={(e) => setForm({ ...form, nama: e.target.value })}
                  placeholder="Budi Santoso"
                  className="w-full rounded-xl border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              {/* Email / No HP */}
              <div>
                <label className="mb-1 block text-sm font-semibold text-gray-700">
                  Email / Nomor HP
                </label>
                <input
                  type="text"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="budi.santoso@rice.id"
                  className="w-full rounded-xl border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                <input
                  type="text"
                  value={form.no_hp}
                  onChange={(e) => setForm({ ...form, no_hp: e.target.value })}
                  placeholder="0812-3456-7890"
                  className="mt-2 w-full rounded-xl border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              {/* Peran & Status Akun */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-semibold text-gray-700">
                    Peran
                  </label>
                  <div className="rounded-xl border bg-gray-50 px-4 py-2.5 text-sm text-gray-500">
                    Pengelola
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-semibold text-gray-700">
                    Status Akun
                  </label>
                  <select
                    value={form.status_akun}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        status_akun: e.target.value as "aktif" | "nonaktif",
                      })
                    }
                    className="w-full rounded-xl border bg-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="aktif">Aktif</option>
                    <option value="nonaktif">Nonaktif</option>
                  </select>
                </div>
              </div>

              {/* Kata Sandi */}
              <div>
                <label className="mb-1 block text-sm font-semibold text-gray-700">
                  Kata Sandi{" "}
                  {isEditing && (
                    <span className="font-normal text-gray-400">
                      (kosongkan jika tidak diubah)
                    </span>
                  )}
                </label>
                <input
                  type="password"
                  value={form.kata_sandi}
                  onChange={(e) =>
                    setForm({ ...form, kata_sandi: e.target.value })
                  }
                  placeholder="••••••••"
                  className="w-full rounded-xl border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              {/* Catatan */}
              <div>
                <label className="mb-1 block text-sm font-semibold text-gray-700">
                  Catatan (opsional)
                </label>
                <textarea
                  value={form.catatan}
                  onChange={(e) =>
                    setForm({ ...form, catatan: e.target.value })
                  }
                  placeholder="Area: Lahan A dan Lahan B"
                  rows={3}
                  className="w-full rounded-xl border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              {/* Error */}
              {formError && (
                <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">
                  {formError}
                </p>
              )}
            </div>

            {/* Tombol */}
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => {
                  setShowModal(false)
                  setForm(emptyForm)
                  setFormError(null)
                }}
                disabled={submitting}
                className="flex-1 rounded-xl border py-2.5 text-sm font-semibold hover:bg-gray-50 disabled:opacity-50"
              >
                Batal
              </button>

              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-1 rounded-xl bg-green-600 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
              >
                {submitting ? "Menyimpan..." : "Simpan"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          MODAL: Konfirmasi Bekukan / Aktifkan
      ══════════════════════════════════════════════════════ */}
      {showFreezeConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="mb-2 text-lg font-bold">
              {freezingCurrentStatus === "aktif"
                ? "Bekukan Akun Pengelola?"
                : "Aktifkan Akun Pengelola?"}
            </h2>
            <p className="mb-6 text-sm text-gray-500">
              {freezingCurrentStatus === "aktif"
                ? `Akun "${freezingPengelola?.nama}" akan dinonaktifkan. Pengelola tidak dapat login sampai diaktifkan kembali.`
                : `Akun "${freezingPengelola?.nama}" akan diaktifkan kembali sehingga pengelola bisa login.`}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowFreezeConfirm(false)
                  setFreezingId(null)
                }}
                className="flex-1 rounded-xl border py-2.5 text-sm font-semibold hover:bg-gray-50"
              >
                Batal
              </button>
              <button
                onClick={handleFreezeConfirm}
                className={`flex-1 rounded-xl py-2.5 text-sm font-semibold text-white ${
                  freezingCurrentStatus === "aktif"
                    ? "bg-yellow-500 hover:bg-yellow-600"
                    : "bg-green-600 hover:bg-green-700"
                }`}
              >
                {freezingCurrentStatus === "aktif" ? "Ya, Bekukan" : "Ya, Aktifkan"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          MODAL: Konfirmasi Hapus
      ══════════════════════════════════════════════════════ */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="mb-2 text-lg font-bold text-red-600">Hapus Akun Pengelola?</h2>
            <p className="mb-6 text-sm text-gray-500">
              Akun <strong>{deletingPengelola?.nama}</strong> akan dihapus secara permanen dari sistem.
              Tindakan ini tidak dapat dibatalkan.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false)
                  setDeletingId(null)
                }}
                className="flex-1 rounded-xl border py-2.5 text-sm font-semibold hover:bg-gray-50"
              >
                Batal
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white hover:bg-red-700"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
