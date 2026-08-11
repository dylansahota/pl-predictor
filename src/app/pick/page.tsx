import { redirect } from "next/navigation"
import { getSession } from "@/lib/auth"
import { supabaseAdmin } from "@/lib/supabase"
import { reuseWindowStart } from "@/lib/season"
import PickClient from "./PickClient"

export default async function PickPage() {
  const session = await getSession()
  if (!session) redirect("/login")

  // Get open gameweek
  const { data: gw } = await supabaseAdmin
    .from("gameweeks")
    .select("id, gw_number")
    .eq("status", "open")
    .single()

  if (!gw) return <div className="p-6 text-gray-500">No active gameweek right now.</div>

  // Get fixtures for this GW
  const { data: fixtures } = await supabaseAdmin
    .from("fixtures")
    .select("id, home_team, away_team, kickoff")
    .eq("gw_id", gw.id)
    .order("kickoff")

  // Get picks already made this GW
  const { data: gwPicks } = await supabaseAdmin
    .from("picks")
    .select("player_id, team_picked, pred_winner, pred_home, pred_away, players(name)")
    .eq("gw_id", gw.id)

  // Get pick order for this GW
  const { data: pickOrder } = await supabaseAdmin
    .from("gw_pick_order")
    .select("position, players(id, name)")
    .eq("gw_id", gw.id)
    .order("position")

  // Teams this player has already used within the current reuse window
  const windowStart = reuseWindowStart(gw.gw_number)

  const { data: windowGws } = await supabaseAdmin
    .from("gameweeks").select("id").gte("gw_number", windowStart)

  const windowGwIds = (windowGws ?? []).map(g => g.id)

  const { data: myPicks } = await supabaseAdmin
    .from("picks")
    .select("team_picked, gw_id")
    .eq("player_id", session.playerId)
    .in("gw_id", windowGwIds)

  const teamsIveUsed = (myPicks ?? []).map(p => p.team_picked)
  const teamsTakenThisGW = (gwPicks ?? []).map(p => p.team_picked)
  const unavailableTeams = [...new Set([...teamsIveUsed, ...teamsTakenThisGW])]

  const alreadyPicked = (gwPicks ?? []).some(p => p.player_id === session.playerId)

  // Get team form
  const { data: teamForm } = await supabaseAdmin
    .from("team_form")
    .select("team, form")

  const formMap: Record<string, string[]> = {}
  for (const tf of teamForm ?? []) formMap[tf.team] = tf.form

  return (
    <PickClient
      session={session}
      gw={gw}
      fixtures={fixtures ?? []}
      gwPicks={gwPicks ?? []}
      pickOrder={(pickOrder ?? []).map(p => ({ position: p.position, player: p.players as any }))}
      unavailableTeams={unavailableTeams}
      alreadyPicked={alreadyPicked}
      teamForm={formMap}
    />
  )
}
