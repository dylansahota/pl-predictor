"use client"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@supabase/supabase-js"
import Nav from "@/components/Nav"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface Props {
  session: { playerId: string; playerName: string }
  gw: { id: string; gw_number: number }
  fixtures: { id: string; home_team: string; away_team: string; kickoff: string }[]
  gwPicks: { player_id: string; team_picked: string; pred_winner: string; pred_home: number; pred_away: number; players: any }[]
  pickOrder: { position: number; player: { id: string; name: string } }[]
  unavailableTeams: string[]
  alreadyPicked: boolean
}

export default function PickClient({ session, gw, fixtures, gwPicks, pickOrder, unavailableTeams, alreadyPicked }: Props) {
  const router = useRouter()
  const [selectedFixture, setSelectedFixture] = useState<Props["fixtures"][0] | null>(null)
  const [predWinner, setPredWinner] = useState<string | null>(null)
  const [predHome, setPredHome] = useState(1)
  const [predAway, setPredAway] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState("")

  // Refresh instantly when anyone submits a pick via Supabase Realtime
  useEffect(() => {
    const channel = supabase
      .channel("picks-changes")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "picks" },
        () => router.refresh()
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [router])

  const pickedPlayerIds = gwPicks.map(p => p.player_id)
  const nextPicker = pickOrder.find(p => !pickedPlayerIds.includes(p.player.id))
  const isMyTurn = nextPicker?.player.id === session.playerId

  const availableFixtures = fixtures.filter(f =>
    !unavailableTeams.includes(f.home_team) || !unavailableTeams.includes(f.away_team)
  )

  const isTeamAvailable = (team: string) => !unavailableTeams.includes(team)

  const handleFixtureSelect = (f: Props["fixtures"][0]) => {
    const homeAvail = isTeamAvailable(f.home_team)
    const awayAvail = isTeamAvailable(f.away_team)
    if (!homeAvail && !awayAvail) return
    setSelectedFixture(f)
    setPredWinner(homeAvail ? f.home_team : f.away_team)
    setPredHome(1)
    setPredAway(0)
    setError("")
  }

  const handleSubmit = async () => {
    if (!selectedFixture || !predWinner) return
    setSubmitting(true)
    setError("")
    const res = await fetch("/api/picks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fixtureId: selectedFixture.id, predWinner, predHome, predAway }),
    })
    if (res.ok) {
      setSubmitted(true)
      router.refresh()
    } else {
      const data = await res.json()
      setError(data.error ?? "Something went wrong")
    }
    setSubmitting(false)
  }

  const impliedWinner = predHome > predAway ? selectedFixture?.home_team : predHome < predAway ? selectedFixture?.away_team : null
  const mismatch = selectedFixture && impliedWinner && predWinner !== impliedWinner

  const noTeamsLeft = availableFixtures.length === 0

  return (
    <div className="min-h-screen pb-20">
      <div className="max-w-lg mx-auto px-4 pt-6">

        {/* Logged in as */}
        <div className="flex justify-between items-center mb-4">
          <span className="text-xs text-gray-400">Logged in as <span className="font-medium text-gray-600">{session.playerName}</span></span>
        </div>

        {/* GW header */}
        <div className="border border-gray-100 rounded-xl p-4 mb-4">
          <div className="flex justify-between items-center mb-1">
            <span className="text-sm font-medium">Gameweek {gw.gw_number}</span>
            {nextPicker && (
              <span className="text-xs bg-amber-50 text-amber-700 px-2 py-1 rounded-md font-medium">
                Next: {nextPicker.player.name}
              </span>
            )}
          </div>
          <div className="text-xs text-gray-400">
            Pick order: {pickOrder.map(p => p.player.name).join(" → ")}
          </div>
        </div>

        {/* Picks so far this GW */}
        {gwPicks.length > 0 && (
          <div className="mb-4">
            <p className="text-xs text-gray-400 mb-2">Picked this gameweek</p>
            <div className="flex flex-col gap-2">
              {pickOrder
                .filter(p => pickedPlayerIds.includes(p.player.id))
                .map(p => {
                  const pick = gwPicks.find(gp => gp.player_id === p.player.id)!
                  return (
                    <div key={p.player.id} className="border border-gray-100 rounded-xl p-3 flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400 w-14">{p.player.name}</span>
                        <span className="text-sm font-medium">{pick.pred_winner} to win</span>
                      </div>
                      <span className="text-sm text-gray-500">{pick.pred_home}–{pick.pred_away}</span>
                    </div>
                  )
                })}
            </div>
          </div>
        )}

        {/* Already picked */}
        {alreadyPicked ? (
          <div className="border border-green-100 rounded-xl p-4">
            <p className="text-sm font-medium text-green-700">You've already picked this gameweek.</p>
            {(() => {
              const mine = gwPicks.find(p => p.player_id === session.playerId)
              return mine ? <p className="text-sm text-gray-500 mt-1">{mine.pred_winner} to win · {mine.pred_home}–{mine.pred_away}</p> : null
            })()}
          </div>

        ) : noTeamsLeft ? (
          <div className="border border-amber-100 rounded-xl p-4">
            <p className="text-sm font-medium text-amber-700">No teams available for you to pick.</p>
            <p className="text-sm text-gray-500 mt-1">All your remaining teams have been taken this gameweek. You'll sit this one out — 0 points for GW{gw.gw_number}.</p>
            {nextPicker && nextPicker.player.id !== session.playerId && (
              <p className="text-sm text-gray-500 mt-1">It's now <span className="font-medium">{nextPicker.player.name}</span>'s turn.</p>
            )}
          </div>

        ) : (
          <>
            {/* Fixture selection */}
            <div className="mb-4">
              <p className="text-xs text-gray-400 mb-2">Select a fixture</p>
              <div className="flex flex-col gap-2">
                {fixtures.map(f => {
                  const homeAvail = isTeamAvailable(f.home_team)
                  const awayAvail = isTeamAvailable(f.away_team)
                  const anyAvail = homeAvail || awayAvail
                  const selected = selectedFixture?.id === f.id
                  return (
                    <button key={f.id} onClick={() => handleFixtureSelect(f)} disabled={!anyAvail}
                      className={`border rounded-xl p-3 text-left transition-colors ${selected ? "border-black bg-gray-50" : anyAvail ? "border-gray-100 hover:border-gray-300" : "border-gray-100 opacity-40 cursor-not-allowed"}`}>
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm ${homeAvail ? "font-medium" : "text-gray-400 line-through"}`}>{f.home_team}</span>
                          <span className="text-xs text-gray-300">vs</span>
                          <span className={`text-sm ${awayAvail ? "font-medium" : "text-gray-400 line-through"}`}>{f.away_team}</span>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-gray-400">
                            {new Date(f.kickoff).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
                          </div>
                          <div className="text-xs text-gray-400">
                            {new Date(f.kickoff).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                          </div>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Score + winner */}
            {selectedFixture && (
              <div className="border border-gray-100 rounded-xl p-4 mb-4">
                <p className="text-xs text-gray-400 mb-3">Predict the score</p>
                <div className="flex items-center justify-center gap-3 mb-4">
                  <span className="text-sm text-gray-500 flex-1 text-right">{selectedFixture.home_team}</span>
                  <div className="flex items-center gap-2">
                    <input type="number" min={0} max={9} value={predHome}
                      onChange={e => setPredHome(Math.max(0, Math.min(9, +e.target.value)))}
                      className="w-14 h-12 text-center text-xl font-medium border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-black" />
                    <span className="text-gray-300 text-lg">–</span>
                    <input type="number" min={0} max={9} value={predAway}
                      onChange={e => setPredAway(Math.max(0, Math.min(9, +e.target.value)))}
                      className="w-14 h-12 text-center text-xl font-medium border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-black" />
                  </div>
                  <span className="text-sm text-gray-500 flex-1">{selectedFixture.away_team}</span>
                </div>

                <div className="border-t border-gray-100 pt-3">
                  <p className="text-xs text-gray-400 mb-2">Who wins?</p>
                  <div className="flex gap-2">
                    {[selectedFixture.home_team, selectedFixture.away_team].map(team => (
                      <button key={team} onClick={() => setPredWinner(team)}
                        disabled={!isTeamAvailable(team)}
                        className={`flex-1 py-2 rounded-full text-sm border transition-colors ${predWinner === team ? "border-black font-medium bg-gray-50" : "border-gray-200 text-gray-600"} disabled:opacity-30 disabled:cursor-not-allowed`}>
                        {team}
                      </button>
                    ))}
                  </div>
                  {mismatch && (
                    <p className="text-xs text-amber-600 mt-2">
                      Note: your score implies {impliedWinner} wins but you've picked {predWinner}. Both are saved — you'll get a point for whichever is correct.
                    </p>
                  )}
                </div>
              </div>
            )}

            {!isMyTurn && (
              <div className="border border-amber-50 rounded-xl p-3 mb-4">
                <p className="text-sm text-amber-700">
                  Waiting for <span className="font-medium">{nextPicker?.player.name}</span> to pick — you can browse but can't submit yet.
                </p>
              </div>
            )}

            {error && <p className="text-sm text-red-500 mb-3">{error}</p>}

            <button onClick={handleSubmit}
              disabled={!selectedFixture || !predWinner || submitting || submitted || !isMyTurn}
              className="w-full py-3 rounded-lg border border-gray-200 text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors">
              {submitted ? "Submitted!" : submitting ? "Submitting..." : !isMyTurn ? `Waiting for ${nextPicker?.player.name}...` : selectedFixture && predWinner ? `Confirm: ${predWinner} to win · ${predHome}–${predAway}` : "Select a fixture to continue"}
            </button>
          </>
        )}
      </div>
      <Nav active="pick" />
    </div>
  )
}
