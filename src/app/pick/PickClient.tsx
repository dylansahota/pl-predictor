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

const c = {
  page:     { minHeight: "100svh", background: "#0f1117", paddingBottom: 90 },
  inner:    { maxWidth: 480, margin: "0 auto", padding: "24px 16px 0" },
  loggedIn: { fontSize: 11, color: "#4ade80", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" as const, marginBottom: 20 },
  gwBar:    { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 },
  gwNum:    { fontSize: 22, fontWeight: 700, color: "#fff", letterSpacing: "-0.02em" },
  gwOrder:  { fontSize: 11, color: "#444c5e", marginTop: 3 },
  tagAmber: { fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 99, background: "#2d2008", color: "#fbbf24", letterSpacing: "0.04em", textTransform: "uppercase" as const },
  tagGreen: { fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 99, background: "#111a13", color: "#4ade80", letterSpacing: "0.04em", textTransform: "uppercase" as const },
  sectionLabel: { fontSize: 11, color: "#555", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" as const, margin: "20px 0 10px" },
  card:     { background: "#181c24", border: "1px solid #252a35", borderRadius: 12, padding: "12px 14px", marginBottom: 8 },
  cardGreen:{ background: "#111a13", border: "1px solid #4ade80", borderRadius: 12, padding: "12px 14px", marginBottom: 8 },
  cardAmber:{ background: "#1a1500", border: "1px solid #854f0b", borderRadius: 12, padding: "12px 14px", marginBottom: 8 },
  pickedRow:{ display: "flex", justifyContent: "space-between", alignItems: "center" },
  pickedName:{ fontSize: 12, color: "#555", minWidth: 56 },
  pickedTeam:{ fontSize: 13, color: "#ddd", fontWeight: 500 },
  pickedScore:{ fontSize: 13, color: "#555" },
  fixtureRow:(sel: boolean, avail: boolean) => ({
    background: sel ? "#111a13" : "#181c24",
    border: `1px solid ${sel ? "#4ade80" : "#252a35"}`,
    borderRadius: 12, padding: "14px 16px", marginBottom: 8,
    display: "flex", justifyContent: "space-between", alignItems: "center",
    cursor: avail ? "pointer" : "default", opacity: avail ? 1 : 0.3,
  }),
  teamName: (avail: boolean) => ({ fontSize: 14, color: avail ? "#fff" : "#444", fontWeight: 500, textDecoration: avail ? "none" : "line-through" }),
  vs:       { fontSize: 11, color: "#333", margin: "0 6px" },
  koWrap:   { textAlign: "right" as const },
  koDate:   { fontSize: 11, color: "#555" },
  koTime:   { fontSize: 12, color: "#888", fontWeight: 500 },
  scoreBox: { background: "#181c24", border: "1px solid #252a35", borderRadius: 12, padding: 16, marginBottom: 12 },
  scoreRow: { display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 14 },
  scoreInput:{ width: 56, height: 56, background: "#0f1117", border: "1.5px solid #2a2f3d", borderRadius: 10, color: "#fff", fontSize: 24, fontWeight: 700, textAlign: "center" as const, outline: "none" },
  scoreSep: { fontSize: 20, color: "#333" },
  teamLbl:  { fontSize: 12, color: "#555", flex: 1 },
  divider:  { borderTop: "1px solid #1e2230", paddingTop: 12, marginTop: 2 },
  winLabel: { fontSize: 11, color: "#555", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" as const, marginBottom: 8 },
  winnerRow:{ display: "flex", gap: 8 },
  winBtn:   (a: boolean, dis: boolean) => ({ flex: 1, padding: "11px 0", borderRadius: 99, fontSize: 13, fontWeight: 600, border: `1px solid ${a ? "#4ade80" : "#252a35"}`, background: a ? "#111a13" : "#0f1117", color: a ? "#4ade80" : "#555", cursor: dis ? "not-allowed" : "pointer", opacity: dis ? 0.4 : 1, textAlign: "center" as const }),
  mismatch: { fontSize: 12, color: "#fbbf24", marginTop: 8 },
  submitBtn:(dis: boolean) => ({ width: "100%", padding: 16, borderRadius: 12, fontSize: 15, fontWeight: 700, border: "none", background: dis ? "#1a2020" : "#4ade80", color: dis ? "#333" : "#0a1a0c", cursor: dis ? "default" : "pointer", letterSpacing: "0.01em" }),
  errTxt:   { fontSize: 13, color: "#e53e3e", marginBottom: 12 },
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

  useEffect(() => {
    const channel = supabase
      .channel("picks-changes")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "picks" }, () => router.refresh())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [router])

  const pickedPlayerIds = gwPicks.map(p => p.player_id)
  const nextPicker = pickOrder.find(p => !pickedPlayerIds.includes(p.player.id))
  const isMyTurn = nextPicker?.player.id === session.playerId
  const isTeamAvailable = (t: string) => !unavailableTeams.includes(t)
  const noTeamsLeft = fixtures.every(f => !isTeamAvailable(f.home_team) && !isTeamAvailable(f.away_team))

  const handleFixtureSelect = (f: Props["fixtures"][0]) => {
    const homeAvail = isTeamAvailable(f.home_team)
    const awayAvail = isTeamAvailable(f.away_team)
    if (!homeAvail && !awayAvail) return
    setSelectedFixture(f)
    setPredWinner(homeAvail ? f.home_team : f.away_team)
    setPredHome(1); setPredAway(0); setError("")
  }

  const handleSubmit = async () => {
    if (!selectedFixture || !predWinner || !isMyTurn) return
    setSubmitting(true); setError("")
    const res = await fetch("/api/picks", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fixtureId: selectedFixture.id, predWinner, predHome, predAway }),
    })
    if (res.ok) { setSubmitted(true); router.refresh() }
    else { const d = await res.json(); setError(d.error ?? "Something went wrong") }
    setSubmitting(false)
  }

  const impliedWinner = predHome > predAway ? selectedFixture?.home_team : predHome < predAway ? selectedFixture?.away_team : null
  const mismatch = selectedFixture && impliedWinner && predWinner !== impliedWinner

  const formatKO = (kickoff: string) => {
    const d = new Date(kickoff)
    return {
      date: d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" }),
      time: d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
    }
  }

  return (
    <div style={c.page}>
      <div style={c.inner}>
        <div style={c.loggedIn}>Logged in as {session.playerName}</div>

        <div style={c.gwBar}>
          <div>
            <div style={c.gwNum}>Gameweek {gw.gw_number}</div>
            <div style={c.gwOrder}>Pick order: {pickOrder.map(p => p.player.name).join(" → ")}</div>
          </div>
          {nextPicker && <span style={isMyTurn ? c.tagGreen : c.tagAmber}>{isMyTurn ? "Your turn" : `Next: ${nextPicker.player.name}`}</span>}
        </div>

        {gwPicks.length > 0 && (
          <>
            <div style={c.sectionLabel}>Picked this week</div>
            {pickOrder.filter(p => pickedPlayerIds.includes(p.player.id)).map(p => {
              const pick = gwPicks.find(gp => gp.player_id === p.player.id)!
              return (
                <div key={p.player.id} style={c.card}>
                  <div style={c.pickedRow}>
                    <span style={c.pickedName}>{p.player.name}</span>
                    <span style={c.pickedTeam}>{pick.pred_winner} to win</span>
                    <span style={c.pickedScore}>{pick.pred_home}–{pick.pred_away}</span>
                  </div>
                </div>
              )
            })}
          </>
        )}

        {alreadyPicked ? (
          <div style={c.cardGreen}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#4ade80" }}>You've already picked this gameweek.</p>
            {(() => { const mine = gwPicks.find(p => p.player_id === session.playerId); return mine ? <p style={{ margin: "4px 0 0", fontSize: 13, color: "#555" }}>{mine.pred_winner} to win · {mine.pred_home}–{mine.pred_away}</p> : null })()}
          </div>
        ) : noTeamsLeft ? (
          <div style={c.cardAmber}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#fbbf24" }}>No teams available.</p>
            <p style={{ margin: "6px 0 0", fontSize: 13, color: "#666" }}>All your remaining teams have been taken. You'll sit this one out — 0 pts for GW{gw.gw_number}.</p>
            {nextPicker && nextPicker.player.id !== session.playerId && <p style={{ margin: "6px 0 0", fontSize: 13, color: "#666" }}>It's now <strong style={{ color: "#ddd" }}>{nextPicker.player.name}</strong>'s turn.</p>}
          </div>
        ) : (
          <>
            {!isMyTurn && (
              <div style={c.cardAmber}>
                <p style={{ margin: 0, fontSize: 13, color: "#fbbf24" }}>
                  Waiting for <strong style={{ color: "#fbbf24" }}>{nextPicker?.player.name}</strong> to pick — browse below but you can't submit yet.
                </p>
              </div>
            )}

            <div style={c.sectionLabel}>Select a fixture</div>
            {fixtures.map(f => {
              const homeAvail = isTeamAvailable(f.home_team)
              const awayAvail = isTeamAvailable(f.away_team)
              const anyAvail = homeAvail || awayAvail
              const sel = selectedFixture?.id === f.id
              const ko = formatKO(f.kickoff)
              return (
                <div key={f.id}>
                  <div style={c.fixtureRow(sel, anyAvail)} onClick={() => anyAvail && handleFixtureSelect(f)}>
                    <div style={{ display: "flex", alignItems: "center" }}>
                      <span style={c.teamName(homeAvail)}>{f.home_team}</span>
                      <span style={c.vs}>vs</span>
                      <span style={c.teamName(awayAvail)}>{f.away_team}</span>
                    </div>
                    <div style={c.koWrap}>
                      <div style={c.koDate}>{ko.date}</div>
                      <div style={c.koTime}>{ko.time}</div>
                    </div>
                  </div>

                  {sel && (
                    <div style={{ ...c.scoreBox, marginTop: -4, borderTopLeftRadius: 0, borderTopRightRadius: 0, borderTop: "none" }}>
                      <div style={c.sectionLabel}>Predict the score</div>
                      <div style={c.scoreRow}>
                        <span style={{ ...c.teamLbl, textAlign: "right" }}>{f.home_team}</span>
                        <input type="number" min={0} max={9} value={predHome} onChange={e => setPredHome(Math.max(0, Math.min(9, +e.target.value)))} style={c.scoreInput} />
                        <span style={c.scoreSep}>–</span>
                        <input type="number" min={0} max={9} value={predAway} onChange={e => setPredAway(Math.max(0, Math.min(9, +e.target.value)))} style={c.scoreInput} />
                        <span style={c.teamLbl}>{f.away_team}</span>
                      </div>
                      <div style={c.divider}>
                        <div style={c.winLabel}>Who wins?</div>
                        <div style={c.winnerRow}>
                          {[f.home_team, f.away_team].map(team => (
                            <button key={team} style={c.winBtn(predWinner === team, !isTeamAvailable(team))}
                              disabled={!isTeamAvailable(team)} onClick={() => setPredWinner(team)}>
                              {team}
                            </button>
                          ))}
                        </div>
                        {mismatch && <p style={c.mismatch}>Score implies {impliedWinner} wins but you've picked {predWinner} — both saved, you'll get a point for whichever is correct.</p>}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}

            {error && <p style={c.errTxt}>{error}</p>}
            <button style={c.submitBtn(!selectedFixture || !predWinner || submitting || submitted || !isMyTurn)} onClick={handleSubmit}
              disabled={!selectedFixture || !predWinner || submitting || submitted || !isMyTurn}>
              {submitted ? "Submitted!" : submitting ? "Submitting..." : !isMyTurn ? `Waiting for ${nextPicker?.player.name}...` : selectedFixture && predWinner ? `Confirm: ${predWinner} to win · ${predHome}–${predAway}` : "Select a fixture to continue"}
            </button>
          </>
        )}
      </div>
      <Nav active="pick" />
    </div>
  )
}
