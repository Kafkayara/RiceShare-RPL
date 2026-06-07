"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Edit3, Plus, Search, Trash2, UserCog, X } from "lucide-react"

import { supabase } from "@/lib/supabase"
import RiceShareTopNav from "@/components/RiceShareTopNav"

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

  const [user, setUser] = useState<UserProfile | null>(null)
  const [pengelolaList, setPengelolaList] = useState<PengelolaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [showModal, setShowModal] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  useEffect(() => {
    const savedUser = localStorage.getItem("riceshare_user")

    if (!savedUser) {
      router.push("/")
      return
    }

    const parsedUser = JSON.parse(savedUser) as UserProfile

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
      .select("id, nama, email, role")
      .eq("role", "pengelola")
      .order("nama", { ascending: true })

    if (error) console.error("FETCH ERROR:", error.message)
    setPengelolaList((data ?? []) as PengelolaItem[])
    setLoading(false)
  }

  useEffect(() => {
    if (user) fetchPengelola()
  }, [user])

  const filteredPengelola = useMemo(() => {
    const keyword = searchQuery.toLowerCase()
    return pengelolaList.filter(
      (p) =>
        p.nama.toLowerCase().includes(keyword) ||
        p.email.toLowerCase().includes(keyword)
    )
  }, [pengelolaList, searchQuery])

  const handleTambah = () => {
    setIsEditing(false)
    setEditingId(null)
    setForm(emptyForm)
    setFormError(null)
    setShowModal(true)
  }

  const handleEdit = (p: PengelolaItem) => {
    setIsEditing(true)
    setEditingId(p.id)
    setForm({ nama: p.nama, email: p.email, password: "" })
    setFormError(null)
    setShowModal(true)
  }

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

    if (!isEditing && !form.password.trim()) {
      setFormError("Kata sandi wajib diisi untuk pengelola baru.")
      return
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
        setSubmitting(false)
        return
      }
    } else {
      const { data: existing } = await supabase
        .from("users")
        .select("id")
        .eq("email", form.email.trim().toLowerCase())
        .maybeSingle()

      if (existing) {
        setFormError("Email sudah terdaftar.")
        setSubmitting(false)
        return
      }

      const { error } = await supabase.from("users").insert({
        nama: form.nama.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password.trim(),
        role: "pengelola",
      })

      if (error) {
        setFormError(`Gagal menambahkan: ${error.message}`)
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

  const handleDeleteConfirm = async () => {
    if (!deletingId) return

    const { error } = await supabase.from("users").delete().eq("id", deletingId)
    if (error) console.error("DELETE ERROR:", error.message)

    setShowDeleteConfirm(false)
    setDeletingId(null)
    fetchPengelola()
  }

  if (!user) return null

  const deletingPengelola = pengelolaList.find((p) => p.id === deletingId)

  return (
    <main className="min-h-screen bg-[#f7faf5] text-gray-950">
      <RiceShareTopNav user={user} />

      <div className="pb-28 lg:pb-10">
        <div className="mx-auto w-full max-w-7xl px-4 py-5 md:px-6 md:py-7">
          <section className="mb-5 rounded-[28px] border border-gray-100 bg-white p-5 shadow-[0_10px_35px_rgba(15,23,42,0.07)]">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-green-700 to-lime-500 text-white shadow-lg">
                  <UserCog size={32} />
                </div>
                <div>
                  <p className="text-sm font-black uppercase tracking-[0.2em] text-green-700">Pemilik</p>
                  <h1 className="mt-1 text-2xl font-black md:text-3xl">Kelola Pengelola</h1>
                  <p className="mt-1 text-sm font-medium text-gray-500">Tambah, edit, dan hapus akun pengelola sawah.</p>
                </div>
              </div>

              <button
                onClick={handleTambah}
                className="flex items-center justify-center gap-2 rounded-2xl bg-green-700 px-5 py-3 text-sm font-black text-white shadow-lg transition hover:scale-[1.02]"
              >
                <Plus size={18} />
                Tambah Pengelola
              </button>
            </div>
          </section>

          <section className="rounded-[28px] border border-gray-100 bg-white p-4 shadow-[0_10px_35px_rgba(15,23,42,0.07)] md:p-5">
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg font-black">Daftar Pengelola</h2>
                <p className="text-sm font-medium text-gray-500">
                  {searchQuery
                    ? `${filteredPengelola.length} dari ${pengelolaList.length} pengelola cocok dengan pencarian.`
                    : `${pengelolaList.length} pengelola terdaftar.`}
                </p>
              </div>
              <div className="relative w-full md:w-80">
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Cari nama atau email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-2xl border border-gray-100 bg-gray-50 py-3 pl-11 pr-11 text-sm font-semibold outline-none transition focus:border-green-300 focus:bg-white focus:ring-2 focus:ring-green-100"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-200 hover:text-gray-700"
                    aria-label="Hapus pencarian"
                  >
                    <X size={15} />
                  </button>
                )}
              </div>
            </div>

            {loading ? (
              <div className="rounded-2xl border border-dashed border-green-200 bg-green-50 p-6 text-center text-sm font-semibold text-green-700">
                Memuat data pengelola...
              </div>
            ) : filteredPengelola.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-green-200 bg-green-50 p-6 text-center text-sm font-semibold text-green-700">
                {searchQuery
                  ? `Tidak ada pengelola dengan kata kunci "${searchQuery}".`
                  : "Belum ada pengelola terdaftar. Klik Tambah Pengelola untuk menambahkan."}
              </div>
            ) : (
              <>
                <div className="hidden overflow-hidden rounded-2xl border border-gray-100 md:block">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50 text-left">
                        <th className="px-5 py-3 font-black text-gray-600">Nama Pengelola</th>
                        <th className="px-5 py-3 font-black text-gray-600">Email</th>
                        <th className="px-5 py-3 font-black text-gray-600">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredPengelola.map((p) => (
                        <tr key={p.id} className="hover:bg-green-50/60">
                          <td className="px-5 py-4 font-black">{p.nama}</td>
                          <td className="px-5 py-4 font-semibold text-gray-500">{p.email}</td>
                          <td className="px-5 py-4">
                            <div className="flex gap-2">
                              <button onClick={() => handleEdit(p)} className="flex items-center gap-1 rounded-xl border border-green-200 bg-white px-3 py-2 text-xs font-black text-green-700 hover:bg-green-50">
                                <Edit3 size={14} /> Edit
                              </button>
                              <button onClick={() => { setDeletingId(p.id); setShowDeleteConfirm(true) }} className="flex items-center gap-1 rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-black text-red-600 hover:bg-red-50">
                                <Trash2 size={14} /> Hapus
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="divide-y divide-gray-100 md:hidden">
                  {filteredPengelola.map((p) => (
                    <div key={p.id} className="py-4">
                      <p className="font-black">{p.nama}</p>
                      <p className="mb-3 text-sm font-medium text-gray-500">{p.email}</p>
                      <div className="flex gap-2">
                        <button onClick={() => handleEdit(p)} className="flex-1 rounded-xl border border-green-200 py-2 text-sm font-black text-green-700 hover:bg-green-50">Edit</button>
                        <button onClick={() => { setDeletingId(p.id); setShowDeleteConfirm(true) }} className="rounded-xl border border-red-200 px-4 py-2 text-sm font-black text-red-600 hover:bg-red-50">Hapus</button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-[30px] border border-green-100 bg-white p-6 shadow-2xl">
            <h2 className="mb-5 text-xl font-black">{isEditing ? "Edit Pengelola" : "Tambah Pengelola"}</h2>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-black text-gray-700">Nama Lengkap</label>
                <input type="text" value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} placeholder="Budi Santoso" className="w-full rounded-xl border border-green-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-black text-gray-700">Email</label>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="budi@email.com" className="w-full rounded-xl border border-green-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-black text-gray-700">
                  Kata Sandi {isEditing && <span className="font-normal text-gray-400">(kosongkan jika tidak diubah)</span>}
                </label>
                <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="••••••••" className="w-full rounded-xl border border-green-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
              {formError && (
                <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-600">{formError}</p>
              )}
            </div>
            <div className="mt-6 flex gap-3">
              <button onClick={() => { setShowModal(false); setForm(emptyForm); setFormError(null) }} disabled={submitting} className="flex-1 rounded-xl border py-2.5 text-sm font-black hover:bg-gray-50 disabled:opacity-50">Batal</button>
              <button onClick={handleSubmit} disabled={submitting} className="flex-1 rounded-xl bg-green-600 py-2.5 text-sm font-black text-white hover:bg-green-700 disabled:opacity-50">
                {submitting ? "Menyimpan..." : "Simpan"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-[30px] border border-green-100 bg-white p-6 shadow-2xl">
            <h2 className="mb-2 text-lg font-black text-red-600">Hapus Akun Pengelola?</h2>
            <p className="mb-6 text-sm text-gray-500">
              Akun <strong>{deletingPengelola?.nama}</strong> akan dihapus permanen. Tindakan ini tidak dapat dibatalkan.
            </p>
            <div className="flex gap-3">
              <button onClick={() => { setShowDeleteConfirm(false); setDeletingId(null) }} className="flex-1 rounded-xl border py-2.5 text-sm font-black hover:bg-gray-50">Batal</button>
              <button onClick={handleDeleteConfirm} className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-black text-white hover:bg-red-700">Ya, Hapus</button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
