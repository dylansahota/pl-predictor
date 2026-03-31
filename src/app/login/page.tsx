"use client"
import { useState, useRef } from "react"
import { useRouter } from "next/navigation"

const PLAYERS = ["Damien", "Tunde", "Gowth", "Dyl"]

const s = {
  page:    { minHeight: "100svh", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px", background: "#0f1117" },
  wrap:    { width: "100%", maxWidth: 360 },
  title:   { fontSize: 28, fontWeight: 700, color: "#fff", margin: "0 0 4px", letterSpacing: "-0.02em" },
  sub:     { fontSize: 14, color: "#555", margin: "0 0 36px" },
  label:   { fontSize: 11, color: "#555", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" as const, display: "block", marginBottom: 10 },
  pills:   { display: "flex", gap: 8, flexWrap: "wrap" as const, marginBottom: 28 },
  pill:    (a: boolean) => ({ padding: "10px 18px", borderRadius: 99, fontSize: 14, fontWeight: a ? 600 : 400, border: a ? "1.5px solid #4ade80" : "1px solid #252a35", background: a ? "#111a13" : "#181c24", color: a ? "#4ade80" : "#666", cursor: "pointer" }),
  pins:    { display: "flex", gap: 12, marginBottom: 20 },
  pin:     (err: boolean) => ({ width: 64, height: 64, textAlign: "center" as const, fontSize: 26, fontWeight: 600, borderRadius: 12, border: `1.5px solid ${err ? "#e53e3e" : "#252a35"}`, background: "#181c24", color: "#fff", outline: "none" }),
  err:     { fontSize: 13, color: "#e53e3e", marginBottom: 16 },
  btn:     (dis: boolean) => ({ width: "100%", padding: 16, borderRadius: 12, fontSize: 15, fontWeight: 700, border: "none", background: dis ? "#1a2020" : "#4ade80", color: dis ? "#333" : "#0a1a0c", cursor: dis ? "default" : "pointer", letterSpacing: "0.01em" }),
}

export default function LoginPage() {
  const router = useRouter()
  const [player, setPlayer] = useState("Damien")
  const [pin, setPin] = useState(["", "", "", ""])
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const refs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)]

  const handleDigit = (i: number, val: string) => {
    if (!/^\d?$/.test(val)) return
    const next = [...pin]; next[i] = val; setPin(next); setError("")
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
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: player, pin: entered }),
    })
    if (res.ok) { router.push("/pick") }
    else { setError("Incorrect PIN, try again."); setPin(["", "", "", ""]); refs[0].current?.focus() }
    setLoading(false)
  }

  return (
    <div style={s.page}>
      <div style={s.wrap}>
        <h1 style={s.title}>PL Predictor</h1>
        <p style={s.sub}>Sign in with your PIN</p>

        <span style={s.label}>Who are you?</span>
        <div style={s.pills}>
          {PLAYERS.map(p => (
            <button key={p} style={s.pill(player === p)}
              onClick={() => { setPlayer(p); setPin(["", "", "", ""]); setError("") }}>
              {p}
            </button>
          ))}
        </div>

        <span style={s.label}>Enter your PIN</span>
        <div style={s.pins}>
          {[0,1,2,3].map(i => (
            <input key={i} ref={refs[i]} type="password" inputMode="numeric"
              maxLength={1} value={pin[i]}
              onChange={e => handleDigit(i, e.target.value)}
              onKeyDown={e => handleKeyDown(i, e)}
              style={s.pin(!!error)} />
          ))}
        </div>
        {error && <p style={s.err}>{error}</p>}
        <button style={s.btn(pin.join("").length < 4 || loading)} onClick={handleSubmit} disabled={pin.join("").length < 4 || loading}>
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </div>
    </div>
  )
}
