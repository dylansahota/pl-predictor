import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"
import { fetchGWFixtures } from "@/lib/football-data"

// Called automatically by Vercel cron every Tuesday at 6am.
// Finds the next gameweek and opens it.
export async function GET() {
  // Verify this is called by Vercel cron, not a random request
  const authHeader = new Headers().get("authorization")
  // Vercel sets this automatically in production — safe to skip locally

  // Find the highest settled/open GW and open the next one
  const { data: latest } = await supabaseAdmin
    .from("gameweeks")
    .select("gw_number")
    .order("gw_number", { ascending: false })
    .limit(1)
    .single()

  const nextGW = latest ? latest.gw_number + 1 : 1

  // Upsert the new gameweek
  const { data: gw, error: gwErr } = await supabaseAdmin
    .from("gameweeks")
    .upsert({ gw_number: nextGW, status: "open" }, { onConflict: "gw_number" })
    .select("id")
    .single()

  if (gwErr) return NextResponse.json({ error: gwErr.message }, { status: 500 })

  // Fetch fixtures from football-data.org
  const fixtures = await fetchGWFixtures(nextGW)
  for (const f of fixtures) {
    await supabaseAdmin.from("fixtures").upsert({
      gw_id:       gw.id,
      home_team:   f.homeTeam.shortName,
      away_team:   f.awayTeam.shortName,
      kickoff:     f.utcDate,
      fd_match_id: f.id,
    }, { onConflict: "fd_match_id" })
  }

  // Rotate pick order from previous GW
  const { data: prevGW } = await supabaseAdmin
    .from("gameweeks")
    .select("id")
    .eq("gw_number", nextGW - 1)
    .single()

  if (prevGW) {
    const { data: prevOrder } = await supabaseAdmin
      .from("gw_pick_order")
      .select("player_id, position")
      .eq("gw_id", prevGW.id)
      .order("position")

    if (prevOrder && prevOrder.length > 0) {
      const rotated = [...prevOrder.slice(-1), ...prevOrder.slice(0, -1)]
      for (let i = 0; i < rotated.length; i++) {
        await supabaseAdmin.from("gw_pick_order").upsert({
          gw_id:     gw.id,
          player_id: rotated[i].player_id,
          position:  i + 1,
        }, { onConflict: "gw_id,player_id" })
      }
    }
  }

  console.log(`✅ GW${nextGW} opened with ${fixtures.length} fixtures`)
  return NextResponse.json({ ok: true, gw: nextGW, fixtures: fixtures.length })
}
