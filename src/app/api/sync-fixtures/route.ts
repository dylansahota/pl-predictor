import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"
import { fetchGWFixtures } from "@/lib/football-data"

// Call this at the start of each new gameweek to populate fixtures.
// Can be triggered manually or via a Vercel cron job.
// Protected by a simple secret to prevent abuse.

export async function POST(req: Request) {
  const { secret, gwNumber } = await req.json()
  if (secret !== process.env.SYNC_SECRET)
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 })

  if (!gwNumber)
    return NextResponse.json({ error: "gwNumber required" }, { status: 400 })

  // Upsert gameweek row
  const { data: gw, error: gwErr } = await supabaseAdmin
    .from("gameweeks")
    .upsert({ gw_number: gwNumber, status: "open" }, { onConflict: "gw_number" })
    .select("id")
    .single()
  if (gwErr) return NextResponse.json({ error: gwErr.message }, { status: 500 })

  // Fetch fixtures from football-data.org (double GW deduplication handled in lib)
  const fixtures = await fetchGWFixtures(gwNumber)

  // Upsert each fixture
  for (const f of fixtures) {
    await supabaseAdmin.from("fixtures").upsert({
      gw_id:      gw.id,
      home_team:  f.homeTeam.shortName,
      away_team:  f.awayTeam.shortName,
      kickoff:    f.utcDate,
      fd_match_id: f.id,
    }, { onConflict: "fd_match_id" })
  }

  // Seed pick order for this GW based on previous GW's order (rotate by 1)
  const { data: prevGW } = await supabaseAdmin
    .from("gameweeks")
    .select("id")
    .eq("gw_number", gwNumber - 1)
    .single()

  if (prevGW) {
    const { data: prevOrder } = await supabaseAdmin
      .from("gw_pick_order")
      .select("player_id, position")
      .eq("gw_id", prevGW.id)
      .order("position")

    if (prevOrder && prevOrder.length > 0) {
      // Rotate: last picker goes first
      const rotated = [
        ...prevOrder.slice(-1),
        ...prevOrder.slice(0, -1),
      ]
      for (let i = 0; i < rotated.length; i++) {
        await supabaseAdmin.from("gw_pick_order").upsert({
          gw_id:     gw.id,
          player_id: rotated[i].player_id,
          position:  i + 1,
        }, { onConflict: "gw_id,player_id" })
      }
    }
  }

  return NextResponse.json({ ok: true, fixtures: fixtures.length })
}
