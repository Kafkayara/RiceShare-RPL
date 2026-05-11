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
  role: string
}

type FormState = {
  nama: string
  email: string
  password: string
}

const emptyForm: FormState = { nama: "", email: "", password: "" }

export default function PengelolaPage() {
  const router = useRouter()

  const [user, setUser]                           = useState<UserProfile | null>(null)
  const [pengelolaList, setPengelolaList]         = useState<PengelolaItem[]>([])
  const [loading, setLoading]                     = useState(true)
  const [searchQuery, setSearchQuery]             = useState("")
  const [showModal, setShowModal]                 = useState(false)
  const [isEditing, setIsEditing]                 = useState(false)
  const [editingId, setEditingId]                 = useState<string | null>(null)
  const [form, setForm]                           = useState<FormState>(emptyForm)
  const [formError, setFormError]                 = useState<string | null>(null)
  const [submitting, setSubmitting]               = useState(false)
  const [deletingId, setDeletingId]               = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  useEffect(() => {
    const savedUser = localStorage.getItem("riceshare_user")
    if (!savedUser) { router.push("/"); return }
    const parsed = JSON.parse(savedUser) as UserProfile
    if (parsed.role !== "pemilik") { router.push("/dashboard"); return }
    setUser(parsed)
  }, [router])

  const fetchPengelola = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from("users")
      .select("id, nama, email, role")
      .eq("role", "pengelola")
      .order("nama", { ascending: true })
    if (error) console.error("FETCH ERROR:", error.message)
    setPengelolaList((data ?? []) as PengelolaItem[])
    setLoading(false)
  }

  useEffect(() => { if (user) fetchPengelola() }, [user])

  const filteredPengelola = pengelolaList.filter((p) =>
    p.nama.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.email.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleTambah = () => {
    setIsEditing(false); setEditingId(null)
    setForm(emptyForm); setFormError(null); setShowModal(true)
  }

  const handleEdit = (p: PengelolaItem) => {
    setIsEditing(true); setEditingId(p.id)
    setForm({ nama: p.nama, email: p.email, password: "" })
    setFormError(null); setShowModal(true)
  }

  const handleSubmit = async () => {
    setFormError(null)
    if (!form.nama.trim())  { setFormError("Nama lengkap wajib diisi."); return }
    if (!form.email.trim()) { setFormError("Email wajib diisi."); return }
    if (!isEditing && !form.password.trim()) {
      setFormError("Kata sandi wajib diisi untuk pengelola baru."); return
    }
    setSubmitting(true)

    if (isEditing && editingId) {
      const payload: Record<string, string> = {
        nama: form.nama.trim(),
        email: form.email.trim().toLowerCase(),
      }
      if (form.password.trim()) payload.password = form.password.trim()

      const { error } = await supabase.from("users").update(payload).eq("id", editingId)
      if (error) {
        setFormError(`Gagal menyimpan: ${error.message}`)
        setSubmitting(false); return
      }
    } else {
      const { data: existing } = await supabase
        .from("users").select("id")
        .eq("email", form.email.trim().toLowerCase()).maybeSingle()
      if (existing) { setFormError("Email sudah terdaftar."); setSubmitting(false); return }

      const { error } = await supabase.from("users").insert({
        nama:     form.nama.trim(),
        email:    form.email.trim().toLowerCase(),
        password: form.password.trim(),
        role:     "pengelola",
      })
      if (error) {
        setFormError(`Gagal menambahkan: ${error.message}`)
        setSubmitting(false); return
      }
    }

    setSubmitting(false); setShowModal(false)
    setForm(emptyForm); setEditingId(null)
    fetchPengelola()
  }

  const handleDeleteConfirm = async () => {
    if (!deletingId) return
    const { error } = await supabase.from("users").delete().eq("id", deletingId)
    if (error) console.error("DELETE ERROR:", error.message)
    setShowDeleteConfirm(false); setDeletingId(null)
    fetchPengelola()
  }

  if (!user) return null
  const deletingPengelola = pengelolaList.find((p) => p.id === deletingId)

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900">
      <div className="mx-auto w-full max-w-5xl px-4 py-6 md:px-6">

        {/* Header */}
        <header className="mb-6 flex flex-col gap-4 rounded-2xl border bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium text-green-700">RiceShare</p>
            <h1 className="text-2xl font-bold">Manajemen Pengelola</h1>
            <p className="text-sm text-gray-500">Tambah, edit, atau hapus akun pengelola sawah.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => router.push("/dashboard")} className="rounded-xl border px-4 py-2 text-sm font-medium hover:bg-gray-50">
              ← Dashboard
            </button>
            <button onClick={handleTambah} className="rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700">
              + Tambah Pengelola
            </button>
          </div>
        </header>

        {/* Info */}
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-700">
          <span>ℹ️</span>
          <p>Kelola akun pengelola: tambah, edit data, atau hapus akun dari sistem.</p>
        </div>

        {/* Search */}
        <div className="mb-4">
          <input
            type="text"
            placeholder="🔍 Cari pengelola..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border bg-white px-4 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        {/* List */}
        {loading ? (
          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <p className="text-sm text-gray-400">Memuat data pengelola...</p>
          </div>
        ) : filteredPengelola.length === 0 ? (
          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <p className="text-sm text-gray-500">
              {searchQuery
                ? `Tidak ada pengelola dengan kata kunci "${searchQuery}".`
                : "Belum ada pengelola terdaftar. Klik '+ Tambah Pengelola' untuk menambahkan."}
            </p>
          </div>
        ) : (
          <section className="rounded-2xl border bg-white shadow-sm">
            {/* Desktop */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50 text-left">
                    <th className="px-5 py-3 font-semibold text-gray-600">Nama Pengelola</th>
                    <th className="px-5 py-3 font-semibold text-gray-600">Email</th>
                    <th className="px-5 py-3 font-semibold text-gray-600">Peran</th>
                    <th className="px-5 py-3 font-semibold text-gray-600">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredPengelola.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-5 py-4 font-semibold">{p.nama}</td>
                      <td className="px-5 py-4 text-gray-600">{p.email}</td>
                      <td className="px-5 py-4">
                        <span className="rounded-full border border-green-200 bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
                          Pengelola
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex gap-2">
                          <button onClick={() => handleEdit(p)} className="rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-gray-100">Edit</button>
                          <button onClick={() => { setDeletingId(p.id); setShowDeleteConfirm(true) }} className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50">Hapus</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Mobile */}
            <div className="divide-y md:hidden">
              {filteredPengelola.map((p) => (
                <div key={p.id} className="p-4">
                  <p className="font-bold">{p.nama}</p>
                  <p className="mb-3 text-sm text-gray-500">{p.email}</p>
                  <div className="flex gap-2">
                    <button onClick={() => handleEdit(p)} className="flex-1 rounded-xl border py-2 text-sm font-medium hover:bg-gray-50">Edit</button>
                    <button onClick={() => { setDeletingId(p.id); setShowDeleteConfirm(true) }} className="rounded-xl border border-red-200 px-4 py-2 text-sm text-red-500 hover:bg-red-50">Hapus</button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* MODAL: Tambah / Edit */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="mb-5 text-xl font-bold">{isEditing ? "Edit Pengelola" : "Tambah Pengelola"}</h2>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-semibold text-gray-700">Nama Lengkap</label>
                <input type="text" value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} placeholder="Budi Santoso" className="w-full rounded-xl border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-gray-700">Email</label>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="budi@email.com" className="w-full rounded-xl border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-gray-700">Peran</label>
                <div className="rounded-xl border bg-gray-50 px-4 py-2.5 text-sm text-gray-500">Pengelola</div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-gray-700">
                  Kata Sandi {isEditing && <span className="font-normal text-gray-400">(kosongkan jika tidak diubah)</span>}
                </label>
                <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="••••••••" className="w-full rounded-xl border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
              {formError && (
                <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">{formError}</p>
              )}
            </div>
            <div className="mt-6 flex gap-3">
              <button onClick={() => { setShowModal(false); setForm(emptyForm); setFormError(null) }} disabled={submitting} className="flex-1 rounded-xl border py-2.5 text-sm font-semibold hover:bg-gray-50 disabled:opacity-50">Batal</button>
              <button onClick={handleSubmit} disabled={submitting} className="flex-1 rounded-xl bg-green-600 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50">
                {submitting ? "Menyimpan..." : "Simpan"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Konfirmasi Hapus */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="mb-2 text-lg font-bold text-red-600">Hapus Akun Pengelola?</h2>
            <p className="mb-6 text-sm text-gray-500">
              Akun <strong>{deletingPengelola?.nama}</strong> akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.
            </p>
            <div className="flex gap-3">
              <button onClick={() => { setShowDeleteConfirm(false); setDeletingId(null) }} className="flex-1 rounded-xl border py-2.5 text-sm font-semibold hover:bg-gray-50">Batal</button>
              <button onClick={handleDeleteConfirm} className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white hover:bg-red-700">Ya, Hapus</button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
