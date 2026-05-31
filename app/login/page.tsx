"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

export default function LoginPage() {
  const router = useRouter()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: any) => {
    e.preventDefault()

    if (!email || !password) {
      alert("Email dan password wajib diisi")
      return
    }

    setLoading(true)

    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("email", email)
      .eq("password", password)
      .single()

    setLoading(false)

    if (error || !data) {
      alert("Email atau password salah")
      return
    }

    // simpan login ke localStorage
    localStorage.setItem("user", JSON.stringify(data))

    // redirect berdasarkan role
    if (data.role === "pemilik") {
      router.push("/dashboard")
    } else if (data.role === "pengelola") {
      router.push("/panen")
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 via-lime-50 to-emerald-100 p-4">
      <div className="w-full max-w-md rounded-[32px] border border-green-100 bg-white/80 p-8 shadow-2xl backdrop-blur-xl">
        <div className="mb-6 rounded-2xl bg-green-50 p-4 text-center">

  <p className="text-sm font-medium text-green-700">
    Sistem Manajemen Pertanian
  </p>

</div>
        <h1 className="text-3xl font-bold mb-6 text-center">
          🌾 RiceShare Login
        </h1>

        <form onSubmit={handleLogin} className="space-y-4">

          <input
            type="email"
            placeholder="Email"
            className="w-full rounded-2xl border border-green-100 bg-white px-4 py-3 text-gray-800 outline-none transition-all focus:border-green-500 focus:ring-4 focus:ring-green-100"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <input
            type="password"
            placeholder="Password"
            className="w-full rounded-2xl border border-green-100 bg-white px-4 py-3 text-gray-800 outline-none transition-all focus:border-green-500 focus:ring-4 focus:ring-green-100"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-gradient-to-r from-green-500 to-emerald-600 px-4 py-3 font-semibold text-white shadow-lg transition-all hover:scale-[1.02] disabled:opacity-70"
          >
            {loading ? "Loading..." : "Login"}
          </button>

        </form>
      </div>
    </div>
  )
}