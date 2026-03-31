"use client"
import Nav from "@/components/Nav"

const PLAYERS = ["Damien", "Tunde", "Gowth", "Dyl"]

interface Pick { player_id: string; points_awarded: number; team_picked: string; players: any; gameweeks: any }

export default function LeaderboardClient({ allPicks, currentGW, currentGWPicks, picksForTeamsUsed, session }: {
  allPicks: Pick[]
  currentGW: { id: string; gw_number: number } | null
  currentGWPicks: any[]
  picksForTeamsUsed: any[]
  session: { playerName: string }
}) {
  const leaderboard = PLAYERS.map(name => {
    const picks = allPicks.filter(p => p.players?.name === name)
    const total = picks.reduce((s, p) => s + (p.points_awarded ?? 0), 0)
    return { name, total, picks: picks.length, avg: picks.length > 0 ? (total / picks.length).toFixed(1) : "0.0" }
  }).sort((a, b) => b.total - a.total)

  const teamsUsed = (player: string) =>
    [...new Set(picksForTeamsUsed.filter(p => p.players?.name === player).map(p => p.team_picked))]

  return (
    <div className="min-h-screen pb-20">
      <div className="max-w-lg mx-auto px-4 pt-6">

        {/* Leaderboard */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          {leaderboard.map((p, i) => (
            <div key={p.name}
              className={`bg-gray-50 rounded-xl p-4 ${i === 0 ? "col-span-2" : ""}`}>
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-xs text-gray-400 mb-1">{["1st","2nd","3rd","4th"][i]} · {p.name}</div>
                  <div className={`font-medium ${i === 0 ? "text-3xl" : "text-2xl"}`}>{p.total} pts</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Current GW picks */}
        {currentGW && (
          <div className="mb-6">
            <p className="text-xs text-gray-400 mb-2">GW{currentGW.gw_number} picks so far</p>
            {currentGWPicks.length === 0
              ? <p className="text-sm text-gray-300">No picks yet.</p>
              : currentGWPicks.map((p, i) => (
                <div key={i} className="border border-gray-100 rounded-xl p-3 flex justify-between mb-2">
                  <span className="text-sm text-gray-500">{p.players?.name}</span>
                  <span className="text-sm font-medium">{p.pred_winner} to win · {p.pred_home}–{p.pred_away}</span>
                </div>
              ))
            }
          </div>
        )}

        {/* Teams used */}
        <div>
          <p className="text-xs text-gray-400 mb-2">Teams used</p>
          {PLAYERS.map(name => {
            const used = teamsUsed(name)
            return (
              <div key={name} className="border border-gray-100 rounded-xl p-3 mb-2">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium">{name}</span>
                  <span className="text-xs text-gray-400">{20 - used.length} of 20 remaining</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {used.map(t => (
                    <span key={t} className="text-xs bg-gray-50 text-gray-500 px-2 py-0.5 rounded-md border border-gray-100">{t}</span>
                  ))}
                  {used.length === 0 && <span className="text-xs text-gray-300">None yet</span>}
                </div>
              </div>
            )
          })}
        </div>
      </div>
      <Nav active="leaderboard" />
    </div>
  )
}
