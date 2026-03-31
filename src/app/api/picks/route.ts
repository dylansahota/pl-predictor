import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"
import { getSession } from "@/lib/auth"

export async function POST(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })

  const { fixtureId, predWinner, predHome, predAway } = await req.json()

  if (!fixtureId || !predWinner || predHome == null || predAway == null)
    return NextResponse.json({ error: "Missing fields" }, { status: 400 })

  // Get current open gameweek
  const { data: gw } = await supabaseAdmin
    .from("gameweeks")
    .select("id, gw_number")
    .eq("status", "open")
    .single()
  if (!gw) return NextResponse.json({ error: "No open gameweek" }, { status: 400 })

  // Check player hasn't already picked this GW
  const { data: existing } = await supabaseAdmin
    .from("picks")
    .select("id")
    .eq("player_id", session.playerId)
    .eq("gw_id", gw.id)
    .single()
  if (existing) return NextResponse.json({ error: "Already picked this gameweek" }, { status: 400 })

  // Check fixture exists and belongs to this GW
  const { data: fixture } = await supabaseAdmin
    .from("fixtures")
    .select("id, home_team, away_team")
    .eq("id", fixtureId)
    .eq("gw_id", gw.id)
    .single()
  if (!fixture) return NextResponse.json({ error: "Invalid fixture" }, { status: 400 })

  // Check team hasn't been picked by this player since GW19
  const { data: gwReset } = await supabaseAdmin
    .from("gameweeks")
    .select("id")
    .eq("gw_number", 19)
    .single()

  const { data: prevPicks } = await supabaseAdmin
    .from("picks")
    .select("team_picked, gw_id")
    .eq("player_id", session.playerId)

  // Get all GW ids since reset
  const { data: gwsSinceReset } = await supabaseAdmin
    .from("gameweeks")
    .select("id, gw_number")
    .gte("gw_number", 20)

  const gwIdsSinceReset = new Set(gwsSinceReset?.map(g => g.id) ?? [])
  const teamsUsed = (prevPicks ?? [])
    .filter(p => gwIdsSinceReset.has(p.gw_id))
    .map(p => p.team_picked)

  const teamPicked = predWinner === fixture.home_team ? fixture.home_team : fixture.away_team
  if (teamsUsed.includes(teamPicked))
    return NextResponse.json({ error: "You have already used this team" }, { status: 400 })

  // Check team hasn't been picked by someone else this GW
  const { data: gwPicks } = await supabaseAdmin
    .from("picks")
    .select("team_picked")
    .eq("gw_id", gw.id)

  const takenTeams = (gwPicks ?? []).map(p => p.team_picked)
  if (takenTeams.includes(teamPicked))
    return NextResponse.json({ error: "This team has already been picked this gameweek" }, { status: 400 })

  // Insert pick
  const { error } = await supabaseAdmin.from("picks").insert({
    player_id:     session.playerId,
    gw_id:         gw.id,
    fixture_id:    fixtureId,
    team_picked:   teamPicked,
    pred_winner:   predWinner,
    pred_home:     predHome,
    pred_away:     predAway,
    points_awarded: null,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
