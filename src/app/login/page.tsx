"use client"
import { useState, useRef } from "react"
import { useRouter } from "next/navigation"

const PLAYERS = ["Damien", "Tunde", "Gowth", "Dyl"]

export default function LoginPage() {
  const router = useRouter()
  const [player, setPlayer] = useState("Damien")
  const [pin, setPin] = useState(["", "", "", ""])
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const refs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)]

  const handleDigit = (i: number, val: string) => {
    if (!/^\d?$/.test(val)) return
    const next = [...pin]
    next[i] = val
    setPin(next)
    setError("")
    if (val && i < 3) refs[i + 1].current?.focus()
  }

  const handleKeyDown = (i: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !pin[i] && i > 0) refs[i - 1].current?.focus()
    if (e.key === "Enter") handleSubmit()
  }

  const handleSubmit = async () => {
    const entered = pin.join("")
    if (entered.length < 4) return
    setLoading(true)
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: player, pin: entered }),
    })
    if (res.ok) {
      router.push("/pick")
    } else {
      setError("Incorrect PIN, try again.")
      setPin(["", "", "", ""])
      refs[0].current?.focus()
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-medium mb-1">PL Predictor</h1>
        <p className="text-sm text-gray-500 mb-8">Sign in with your PIN</p>

        <div className="mb-6">
          <label className="text-xs text-gray-500 mb-2 block">Who are you?</label>
          <div className="flex gap-2 flex-wrap">
            {PLAYERS.map(p => (
              <button key={p}
                onClick={() => { setPlayer(p); setPin(["", "", "", ""]); setError("") }}
                style={{ padding: "8px 16px", borderRadius: 99, fontSize: 14, border: player === p ? "2px solid black" : "1px solid #e5e7eb", background: player === p ? "#f9fafb" : "white", fontWeight: player === p ? 500 : 400, cursor: "pointer" }}>
                {p}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-6">
          <label className="text-xs text-gray-500 mb-2 block">Enter your 4-digit PIN</label>
          <div className="flex gap-3">
            {[0, 1, 2, 3].map(i => (
              <input key={i} ref={refs[i]} type="password" inputMode="numeric"
                maxLength={1} value={pin[i]}
                onChange={e => handleDigit(i, e.target.value)}
                onKeyDown={e => handleKeyDown(i, e)}
                className={`w-14 h-14 text-center text-2xl font-medium border rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-black ${error ? "border-red-400" : "border-gray-200"}`} />
            ))}
          </div>
          {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
        </div>

        <button onClick={handleSubmit} disabled={pin.join("").length < 4 || loading}
          className="w-full py-3 rounded-lg border border-gray-200 text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors">
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </div>
    </div>
  )
}
