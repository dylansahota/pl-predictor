import { redirect } from "next/navigation"
import { getSession } from "@/lib/auth"
import { supabaseAdmin } from "@/lib/supabase"
import LeaderboardClient from "./LeaderboardClient"

export default async function LeaderboardPage() {
  const session = await getSession()
  if (!session) redirect("/login")

  // All settled picks for totals
  const { data: allPicks } = await supabaseAdmin
    .from("picks")
    .select("player_id, points_awarded, team_picked, gw_id, players(id, name), gameweeks(gw_number, status)")
    .not("points_awarded", "is", null)

  // Current open GW picks
  const { data: gw } = await supabaseAdmin
    .from("gameweeks").select("id, gw_number").eq("status", "open").single()

  const { data: currentGWPicks } = gw ? await supabaseAdmin
    .from("picks")
    .select("pred_winner, pred_home, pred_away, team_picked, players(name)")
    .eq("gw_id", gw.id) : { data: [] }

  // Teams used per player since GW19
  const { data: gwsSinceReset } = await supabaseAdmin
    .from("gameweeks").select("id").gte("gw_number", 20)
  const gwIdsSinceReset = (gwsSinceReset ?? []).map(g => g.id)

  const { data: picksForTeamsUsed } = await supabaseAdmin
    .from("picks")
    .select("player_id, team_picked, players(id, name)")
    .in("gw_id", gwIdsSinceReset)

  return (
    <LeaderboardClient
      allPicks={allPicks ?? []}
      currentGW={gw ?? null}
      currentGWPicks={currentGWPicks ?? []}
      picksForTeamsUsed={picksForTeamsUsed ?? []}
      session={session}
    />
  )
}
