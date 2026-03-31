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

export default function HistoryClient({ picks, session }: { picks: PlayerPick[]; session: { playerName: string } }) {
  const [filter, setFilter] = useState("All")

  const filtered = filter === "All" ? picks : picks.filter(p => p.players.name === filter)

  const ptsBadge = (pts: number | null, status: string) => {
    if (status !== "settled") return { label: "pending", cls: "bg-gray-50 text-gray-400" }
    if (pts === 2) return { label: "2pts", cls: "bg-green-50 text-green-700" }
    if (pts === 1) return { label: "1pt",  cls: "bg-amber-50 text-amber-700" }
    return { label: "0pts", cls: "bg-red-50 text-red-600" }
  }

  return (
    <div className="min-h-screen pb-20">
      <div className="max-w-lg mx-auto px-4 pt-6">

        <div className="flex gap-2 flex-wrap mb-5">
          {PLAYERS.map(p => (
            <button key={p} onClick={() => setFilter(p)}
              className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${filter === p ? "border-black font-medium bg-gray-50" : "border-gray-200 text-gray-500"}`}>
              {p}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-2">
          {filtered.map(p => {
            const { label, cls } = ptsBadge(p.points_awarded, p.gameweeks.status)
            const fix = p.fixtures
            const opponent = fix.home_team === p.team_picked ? fix.away_team : fix.home_team
            const isPending = p.gameweeks.status !== "settled"
            return (
              <div key={p.id} className="border border-gray-100 rounded-xl p-3 flex justify-between items-center">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium">{p.team_picked}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${cls}`}>{label}</span>
                  </div>
                  <div className="text-xs text-gray-400">
                    GW{p.gameweeks.gw_number} · {p.players.name} · vs {opponent}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {p.pred_winner} to win
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium">{p.pred_home}–{p.pred_away}</div>
                  {!isPending && fix.home_score != null
                    ? <div className="text-xs text-gray-400">actual: {fix.home_score}–{fix.away_score}</div>
                    : <div className="text-xs text-gray-300">awaiting result</div>
                  }
                </div>
              </div>
            )
          })}
        </div>
      </div>
      <Nav active="history" />
    </div>
  )
}

