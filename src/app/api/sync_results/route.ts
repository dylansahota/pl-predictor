import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"
import { fetchGWFixtures, fetchGWResults } from "@/lib/football-data"
import { calcPoints } from "@/lib/points"

async function settleCurrentGW() {
  // Get current open GW
  const { data: gw } = await supabaseAdmin
    .from("gameweeks")
    .select("id, gw_number")
    .eq("status", "open")
    .single()

  if (!gw) return { message: "No open gameweek" }

  // Fetch results from API
  const results = await fetchGWResults(gw.gw_number)

  // Get all fixtures for this GW
  const { data: fixtures } = await supabaseAdmin
    .from("fixtures")
    .select("id, fd_match_id, home_team, away_team")
    .eq("gw_id", gw.id)

  if (!fixtures || fixtures.length === 0) return { message: "No fixtures found" }

  // Check all fixtures are finished
  const finishedIds = new Set(results.map((r: any) => r.id))
  const allFinished = fixtures.every(f => f.fd_match_id && finishedIds.has(f.fd_match_id))

  if (!allFinished) {
    const done = fixtures.filter(f => f.fd_match_id && finishedIds.has(f.fd_match_id)).length
    return { message: `${done}/${fixtures.length} finished — not settling yet` }
  }

  // Update all fixture scores
  for (const r of results) {
    await supabaseAdmin
      .from("fixtures")
      .update({ home_score: r.score.fullTime.home, away_score: r.score.fullTime.away })
      .eq("fd_match_id", r.id)
  }

  // Get picks with fixtures and award points
  const { data: picks } = await supabaseAdmin
    .from("picks")
    .select("id, pred_winner, pred_home, pred_away, fixtures(home_team, away_team, fd_match_id)")
    .eq("gw_id", gw.id)

  const summary: Record<string, number> = {}

  for (const pick of picks ?? []) {
    const fix = pick.fixtures as any
    const result = results.find((r: any) => r.id === fix.fd_match_id)
    if (!result) continue

    const hs = result.score.fullTime.home
    const as_ = result.score.fullTime.away
    if (hs === null || as_ === null) continue

    const pts = calcPoints({
      predWinner: pick.pred_winner,
      predHome:   pick.pred_home,
      predAway:   pick.pred_away,
      actualHome: hs,
      actualAway: as_,
      homeTeam:   fix.home_team,
      awayTeam:   fix.away_team,
    })

    await supabaseAdmin.from("picks").update({ points_awarded: pts }).eq("id", pick.id)
    summary[pick.pred_winner] = (summary[pick.pred_winner] ?? 0) + pts
  }

  // Mark GW settled
  await supabaseAdmin.from("gameweeks").update({ status: "settled" }).eq("id", gw.id)

  // Open next GW if it doesn't already exist
  const nextGWNumber = gw.gw_number + 1
  const { data: existingNext } = await supabaseAdmin
    .from("gameweeks").select("id").eq("gw_number", nextGWNumber).single()

  if (!existingNext) {
    try {
      const nextFixtures = await fetchGWFixtures(nextGWNumber)
      if (nextFixtures.length > 0) {
        const { data: nextGW } = await supabaseAdmin
          .from("gameweeks")
          .upsert({ gw_number: nextGWNumber, status: "open" }, { onConflict: "gw_number" })
          .select("id").single()

        if (nextGW) {
          for (const f of nextFixtures) {
            await supabaseAdmin.from("fixtures").upsert({
              gw_id:       nextGW.id,
              home_team:   f.homeTeam.shortName,
              away_team:   f.awayTeam.shortName,
              kickoff:     f.utcDate,
              fd_match_id: f.id,
            }, { onConflict: "fd_match_id" })
          }

          // Rotate pick order from settled GW
          const { data: currentOrder } = await supabaseAdmin
            .from("gw_pick_order").select("player_id, position")
            .eq("gw_id", gw.id).order("position")

          if (currentOrder && currentOrder.length > 0) {
            const rotated = [...currentOrder.slice(-1), ...currentOrder.slice(0, -1)]
            for (let i = 0; i < rotated.length; i++) {
              await supabaseAdmin.from("gw_pick_order").upsert({
                gw_id: nextGW.id, player_id: rotated[i].player_id, position: i + 1,
              }, { onConflict: "gw_id,player_id" })
            }
          }
          console.log(`✅ GW${nextGWNumber} opened with ${nextFixtures.length} fixtures`)
        }
      }
    } catch (e) {
      console.warn("Could not open next GW:", e)
    }
  }

  return { ok: true, gw: gw.gw_number, summary }
}

// Cron job — called automatically by Vercel
export async function GET() {
  const result = await settleCurrentGW()
  return NextResponse.json(result)
}

// Manual trigger — called with secret for safety
export async function POST(req: Request) {
  const { secret } = await req.json()
  if (secret !== process.env.SYNC_SECRET)
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
  const result = await settleCurrentGW()
  return NextResponse.json(result)
}
