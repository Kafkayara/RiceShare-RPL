<<<<<<< HEAD
import { redirect } from "next/navigation"

export default function Home() {
  redirect("/login")
=======
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

export default function Home() {
  const router = useRouter()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()

    setLoading(true)
    setErrorMessage("")

    const { data, error } = await supabase
      .from("users")
      .select("id, nama, email, role")
      .eq("email", email)
      .eq("password", password)
      .single()

    if (error || !data) {
      setErrorMessage("Email atau password salah")
      setLoading(false)
      return
    }

    localStorage.setItem("riceshare_user", JSON.stringify(data))
    router.push("/dashboard")
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-950 text-white p-6">
      <div className="w-full max-w-md rounded-xl bg-gray-900 p-6 shadow">
        <h1 className="text-2xl font-bold mb-2">🌾 RiceShare</h1>
        <p className="text-gray-400 mb-6">
          Login untuk masuk ke sistem
        </p>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm mb-1">Email</label>
            <input
              type="email"
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 outline-none"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="contoh@mail.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm mb-1">Password</label>
            <input
              type="password"
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 outline-none"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              required
            />
          </div>

          {errorMessage && (
            <p className="text-sm text-red-400">{errorMessage}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-green-600 px-4 py-2 font-semibold hover:bg-green-700 disabled:opacity-60"
          >
            {loading ? "Memproses..." : "Login"}
          </button>
        </form>
      </div>
    </main>
  )
>>>>>>> 7049ddb (Update app pages)
}