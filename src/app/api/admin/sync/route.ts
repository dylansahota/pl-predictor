import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"
import { getSession } from "@/lib/auth"
import { fetchGWResults } from "@/lib/football-data"
import { calcPoints } from "@/lib/points"

export const dynamic = "force-dynamic"

const ADMIN_PLAYER = "Dyl"

// On-demand results sync for a single gameweek. Unlike the nightly cron this can
// be run at any time and settles nothing about the pick flow — it just pulls the
// latest scores, updates finished fixtures, and (re)awards points. Idempotent:
// safe to run repeatedly. Only Dyl can call it.
export async function POST(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
  if (session.playerName !== ADMIN_PLAYER)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  // Which gameweek? Optional { gwNumber } in the body, else the open one.
  let gwNumber: number | undefined
  try {
    const body = await req.json()
    if (body && typeof body.gwNumber === "number") gwNumber = body.gwNumber
  } catch {
    // no body — sync the open gameweek
  }

  const { data: gw } = gwNumber
    ? await supabaseAdmin
        .from("gameweeks")
        .select("id, gw_number, status")
        .eq("gw_number", gwNumber)
        .single()
    : await supabaseAdmin
        .from("gameweeks")
        .select("id, gw_number, status")
        .eq("status", "open")
        .single()

  if (!gw)
    return NextResponse.json(
      { error: gwNumber ? `Gameweek ${gwNumber} not found` : "No open gameweek" },
      { status: 404 }
    )

  // Finished results for this gameweek from football-data.org
  const results = await fetchGWResults(gw.gw_number)
  const finishedById = new Map<number, any>(results.map((r: any) => [r.id, r]))

  // Fixtures we track for this gameweek
  const { data: fixtures } = await supabaseAdmin
    .from("fixtures")
    .select("id, fd_match_id, home_team, away_team")
    .eq("gw_id", gw.id)

  if (!fixtures || fixtures.length === 0)
    return NextResponse.json({ error: "No fixtures found for this gameweek" }, { status: 400 })

  // Update scores for any finished fixture
  let fixturesUpdated = 0
  for (const f of fixtures) {
    const r = f.fd_match_id ? finishedById.get(f.fd_match_id) : undefined
    if (!r) continue
    await supabaseAdmin
      .from("fixtures")
      .update({
        home_score: r.score.fullTime.home,
        away_score: r.score.fullTime.away,
      })
      .eq("id", f.id)
    fixturesUpdated++
  }

  // (Re)award points for picks whose fixture has finished
  const { data: picks } = await supabaseAdmin
    .from("picks")
    .select("id, pred_winner, pred_home, pred_away, fixtures(home_team, away_team, fd_match_id)")
    .eq("gw_id", gw.id)

  let picksScored = 0
  for (const pick of picks ?? []) {
    const fix = pick.fixtures as any
    const r = fix?.fd_match_id ? finishedById.get(fix.fd_match_id) : undefined
    if (!r) continue

    const hs = r.score.fullTime.home
    const as_ = r.score.fullTime.away
    if (hs === null || as_ === null) continue

    const pts = calcPoints({
      predWinner: pick.pred_winner,
      predHome: pick.pred_home,
      predAway: pick.pred_away,
      actualHome: hs,
      actualAway: as_,
      homeTeam: fix.home_team,
      awayTeam: fix.away_team,
    })

    await supabaseAdmin.from("picks").update({ points_awarded: pts }).eq("id", pick.id)
    picksScored++
  }

  const finishedCount = fixtures.filter(f => f.fd_match_id && finishedById.has(f.fd_match_id)).length

  return NextResponse.json({
    ok: true,
    gw: gw.gw_number,
    status: gw.status,
    fixturesTotal: fixtures.length,
    fixturesFinished: finishedCount,
    fixturesUpdated,
    picksScored,
  })
}
