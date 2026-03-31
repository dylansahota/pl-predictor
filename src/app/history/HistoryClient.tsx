"use client"
import { useState } from "react"
import Nav from "@/components/Nav"

const PLAYERS = ["All", "Damien", "Tunde", "Gowth", "Dyl"]

interface PlayerPick {
  id: string
  team_picked: string
  pred_winner: string
  pred_home: number
  pred_away: number
  points_awarded: number | null
  skipped: boolean
  players: { id: string; name: string }
  gameweeks: { gw_number: number; status: string }
  fixtures: { home_team: string; away_team: string; home_score: number | null; away_score: number | null }
}

const c = {
  page:    { minHeight: "100svh", background: "#0f1117", paddingBottom: 90 },
  inner:   { maxWidth: 480, margin: "0 auto", padding: "24px 16px 0" },
  pills:   { display: "flex", gap: 8, flexWrap: "wrap" as const, marginBottom: 20 },
  pill:    (a: boolean) => ({ padding: "8px 16px", borderRadius: 99, fontSize: 13, fontWeight: a ? 600 : 400, border: `1px solid ${a ? "#4ade80" : "#252a35"}`, background: a ? "#111a13" : "#181c24", color: a ? "#4ade80" : "#666", cursor: "pointer" }),
  card:    { background: "#181c24", border: "1px solid #252a35", borderRadius: 12, padding: "12px 14px", marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" },
  teamName:{ fontSize: 14, fontWeight: 600, color: "#fff", marginBottom: 3 },
  meta:    { fontSize: 12, color: "#555" },
  score:   { textAlign: "right" as const },
  pred:    { fontSize: 15, fontWeight: 700, color: "#fff" },
  actual:  { fontSize: 12, color: "#555", marginTop: 2 },
  badge:   (pts: number | null, status: string) => {
    if (status !== "settled") return { fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 99, background: "#1e2230", color: "#444", marginLeft: 8 }
    if (pts === 2) return { fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 99, background: "#111a13", color: "#4ade80", marginLeft: 8 }
    if (pts === 1) return { fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 99, background: "#2d2008", color: "#fbbf24", marginLeft: 8 }
    return { fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 99, background: "#1f0f0f", color: "#e53e3e", marginLeft: 8 }
  },
  badgeLabel: (pts: number | null, status: string) => status !== "settled" ? "pending" : pts === 2 ? "2 pts" : pts === 1 ? "1 pt" : "0 pts",
}

export default function HistoryClient({ picks, session }: { picks: PlayerPick[]; session: { playerName: string } }) {
  const [filter, setFilter] = useState("All")
  const filtered = filter === "All" ? picks : picks.filter(p => p.players.name === filter)

  return (
    <div style={c.page}>
      <div style={c.inner}>
        <div style={c.pills}>
          {PLAYERS.map(p => (
            <button key={p} style={c.pill(filter === p)} onClick={() => setFilter(p)}>{p}</button>
          ))}
        </div>

        {filtered.map(p => {
          const fix = p.fixtures
          const opponent = fix.home_team === p.team_picked ? fix.away_team : fix.home_team
          const isPending = p.gameweeks.status !== "settled"
          return (
            <div key={p.id} style={c.card}>
              <div>
                <div style={{ display: "flex", alignItems: "center" }}>
                  <span style={c.teamName}>{p.team_picked}</span>
                  <span style={c.badge(p.points_awarded, p.gameweeks.status)}>{c.badgeLabel(p.points_awarded, p.gameweeks.status)}</span>
                </div>
                <div style={c.meta}>GW{p.gameweeks.gw_number} · {p.players.name} · vs {opponent}</div>
                <div style={{ ...c.meta, marginTop: 1 }}>{p.pred_winner} to win</div>
              </div>
              <div style={c.score}>
                <div style={c.pred}>{p.pred_home}–{p.pred_away}</div>
                {!isPending && fix.home_score != null
                  ? <div style={c.actual}>actual: {fix.home_score}–{fix.away_score}</div>
                  : <div style={{ ...c.actual, color: "#333" }}>awaiting</div>
                }
              </div>
            </div>
          )
        })}
      </div>
      <Nav active="history" />
    </div>
  )
}
