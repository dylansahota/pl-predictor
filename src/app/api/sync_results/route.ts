import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"
import { fetchGWResults } from "@/lib/football-data"
import { calcPoints } from "@/lib/points"

// Call this after a gameweek closes to settle results and award points.
// Protected by a simple secret.

export async function POST(req: Request) {
  const { secret, gwNumber } = await req.json()
  if (secret !== process.env.SYNC_SECRET)
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 })

  // Get gameweek
  const { data: gw } = await supabaseAdmin
    .from("gameweeks")
    .select("id")
    .eq("gw_number", gwNumber)
    .single()
  if (!gw) return NextResponse.json({ error: "Gameweek not found" }, { status: 404 })

  // Fetch finished results
  const results = await fetchGWResults(gwNumber)
  if (results.length === 0)
    return NextResponse.json({ error: "No finished matches found" }, { status: 400 })

  // Update fixture scores
  for (const r of results) {
    await supabaseAdmin
      .from("fixtures")
      .update({ home_score: r.score.fullTime.home, away_score: r.score.fullTime.away })
      .eq("fd_match_id", r.id)
  }

  // Get all picks for this GW with their fixtures
  const { data: picks } = await supabaseAdmin
    .from("picks")
    .select(`
      id, pred_winner, pred_home, pred_away, team_picked,
      fixtures ( id, home_team, away_team, home_score, away_score, fd_match_id )
    `)
    .eq("gw_id", gw.id)

  if (!picks || picks.length === 0)
    return NextResponse.json({ error: "No picks found for this GW" }, { status: 400 })

  const summary: { player_id: string; pts: number }[] = []

  for (const pick of picks) {
    const fix = pick.fixtures as any
    if (!fix?.home_score == null || fix?.away_score == null) continue

    const pts = calcPoints({
      predWinner: pick.pred_winner,
      predHome:   pick.pred_home,
      predAway:   pick.pred_away,
      actualHome: fix.home_score,
      actualAway: fix.away_score,
      homeTeam:   fix.home_team,
      awayTeam:   fix.away_team,
    })

    await supabaseAdmin
      .from("picks")
      .update({ points_awarded: pts })
      .eq("id", pick.id)

    summary.push({ player_id: pick.pred_winner, pts })
  }

  // Mark GW as settled
  await supabaseAdmin
    .from("gameweeks")
    .update({ status: "settled" })
    .eq("id", gw.id)

  return NextResponse.json({ ok: true, settled: picks.length, summary })
}
