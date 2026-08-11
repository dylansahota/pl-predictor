"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import Nav from "@/components/Nav"

interface Gameweek {
  gw_number: number
  status: string
}

interface SyncResult {
  gw: number
  status: string
  fixturesTotal: number
  fixturesFinished: number
  fixturesUpdated: number
  picksScored: number
}

interface Props {
  session: { playerId: string; playerName: string }
  gameweeks: Gameweek[]
  openGw: number | null
}

const c = {
  page:    { minHeight: "100svh", background: "#0f1117", paddingBottom: 90 },
  inner:   { maxWidth: 480, margin: "0 auto", padding: "24px 16px 0" },
  kicker:  { fontSize: 11, color: "#4ade80", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" as const, marginBottom: 6 },
  title:   { fontSize: 22, fontWeight: 700, color: "#fff", letterSpacing: "-0.02em", marginBottom: 20 },
  label:   { fontSize: 11, color: "#555", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" as const, display: "block", marginBottom: 10 },
  card:    { background: "#181c24", border: "1px solid #252a35", borderRadius: 12, padding: 16, marginBottom: 12 },
  cardTitle:{ fontSize: 14, fontWeight: 600, color: "#fff", marginBottom: 4 },
  cardBody:{ fontSize: 13, color: "#6b7280", marginBottom: 14, lineHeight: 1.5 },
  select:  { width: "100%", padding: "12px 14px", background: "#0f1117", border: "1px solid #252a35", borderRadius: 10, color: "#fff", fontSize: 14, marginBottom: 14, outline: "none" },
  btn:     (dis: boolean) => ({ width: "100%", padding: 14, borderRadius: 10, fontSize: 14, fontWeight: 600, border: "none", background: dis ? "#14532d" : "#4ade80", color: dis ? "#4ade80" : "#0a1a0c", cursor: dis ? "not-allowed" : "pointer" }),
  result:  { marginTop: 12, background: "#0f1117", border: "1px solid #252a35", borderRadius: 10, padding: "12px 14px" },
  resultHead:{ fontSize: 11, color: "#4ade80", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" as const, marginBottom: 10 },
  stats:   { display: "flex", gap: 18, flexWrap: "wrap" as const },
  statNum: (n: number) => ({ fontSize: 18, fontWeight: 700, color: n > 0 ? "#4ade80" : "#9ca3af" }),
  statLbl: { fontSize: 11, color: "#6b7280" },
  err:     { marginTop: 12, fontSize: 13, color: "#e53e3e" },
}

export default function AdminClient({ session, gameweeks, openGw }: Props) {
  const router = useRouter()
  const [target, setTarget] = useState<string>(openGw != null ? String(openGw) : "")
  const [syncing, setSyncing] = useState(false)
  const [result, setResult] = useState<SyncResult | null>(null)
  const [error, setError] = useState("")

  const handleSync = async () => {
    setSyncing(true); setError(""); setResult(null)
    const body = target ? { gwNumber: Number(target) } : {}
    const res = await fetch("/api/admin/sync", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!res.ok) setError(data.error ?? "Sync failed")
    else { setResult(data); router.refresh() }
    setSyncing(false)
  }

  return (
    <div style={c.page}>
      <div style={c.inner}>
        <div style={c.kicker}>Admin</div>
        <div style={c.title}>Controls</div>

        <div style={c.card}>
          <div style={c.cardTitle}>Pull scores</div>
          <div style={c.cardBody}>
            Fetches the latest results from football-data.org for the chosen gameweek,
            updates finished fixtures and awards points. Safe to run any time, as often as you like.
          </div>

          <label style={c.label}>Gameweek</label>
          <select style={c.select} value={target} onChange={e => setTarget(e.target.value)}>
            {openGw == null && <option value="">— no open gameweek —</option>}
            {gameweeks.map(g => (
              <option key={g.gw_number} value={g.gw_number}>
                GW{g.gw_number}{g.status === "open" ? " (open)" : ""}
              </option>
            ))}
          </select>

          <button style={c.btn(syncing || !target)} onClick={handleSync} disabled={syncing || !target}>
            {syncing ? "Syncing…" : target ? `Sync GW${target} scores` : "Select a gameweek"}
          </button>

          {result && (
            <div style={c.result}>
              <div style={c.resultHead}>✓ GW{result.gw} synced</div>
              <div style={c.stats}>
                {[
                  { label: `Finished / ${result.fixturesTotal}`, value: result.fixturesFinished },
                  { label: "Scores updated", value: result.fixturesUpdated },
                  { label: "Picks scored", value: result.picksScored },
                ].map(s => (
                  <div key={s.label}>
                    <div style={c.statNum(s.value)}>{s.value}</div>
                    <div style={c.statLbl}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && <div style={c.err}>{error}</div>}
        </div>
      </div>
      <Nav active="admin" playerName={session.playerName} />
    </div>
  )
}
