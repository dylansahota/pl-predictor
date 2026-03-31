import { redirect } from "next/navigation"
import { getSession } from "@/lib/auth"
import { supabaseAdmin } from "@/lib/supabase"
import HistoryClient from "./HistoryClient"

export default async function HistoryPage() {
  const session = await getSession()
  if (!session) redirect("/login")

  const { data: picks } = await supabaseAdmin
    .from("picks")
    .select(`
      id, team_picked, pred_winner, pred_home, pred_away, points_awarded, skipped,
      players ( id, name ),
      gameweeks ( gw_number, status ),
      fixtures ( home_team, away_team, home_score, away_score )
    `)
    .order("gw_number", { referencedTable: "gameweeks", ascending: false })

  return <HistoryClient picks={picks ?? []} session={session} />
}
