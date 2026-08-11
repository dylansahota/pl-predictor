// Wipe last season's data and open a fresh GW1 for the new season.
// Run with: npx tsx scripts/reset-season.ts
//
// Keeps the players table intact (run seed-players.ts separately to (re)set PINs).
// Clears picks, pick order, fixtures, gameweeks and team form, then creates GW1
// (open), pulls its fixtures from football-data.org, and seeds a RANDOM pick
// order. The order rotates automatically from GW2 onward via the crons.
//
// Requires .env.local with SUPABASE + FOOTBALL_DATA_API_KEY set.

import "dotenv/config"
import { createClient } from "@supabase/supabase-js"
import { fetchGWFixtures } from "../src/lib/football-data"

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const ALL_ROWS = "00000000-0000-0000-0000-000000000000" // sentinel for "match everything"

async function wipe(table: string) {
  // PostgREST requires a filter on delete; `id != <impossible uuid>` matches all rows.
  const { error } = await db.from(table).delete().neq("id", ALL_ROWS)
  if (error) throw new Error(`Failed to clear ${table}: ${error.message}`)
  console.log(`🧹 cleared ${table}`)
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

async function main() {
  // Sanity: players must exist (run seed-players.ts first if not)
  const { data: players, error: pErr } = await db.from("players").select("id, name")
  if (pErr) throw pErr
  if (!players || players.length === 0)
    throw new Error("No players found — run `npx tsx scripts/seed-players.ts` first.")
  console.log(`👥 ${players.length} players: ${players.map(p => p.name).join(", ")}`)

  // 1. Wipe season data (FK-safe order: picks reference fixtures/gameweeks;
  //    gw_pick_order and fixtures reference gameweeks).
  await wipe("picks")
  await wipe("gw_pick_order")
  await wipe("fixtures")
  await wipe("gameweeks")
  // team_form is keyed by team name, not id — clear with a name filter.
  {
    const { error } = await db.from("team_form").delete().neq("team", ALL_ROWS)
    if (error) throw new Error(`Failed to clear team_form: ${error.message}`)
    console.log("🧹 cleared team_form")
  }

  // 2. Create GW1 (open)
  const { data: gw, error: gwErr } = await db
    .from("gameweeks")
    .insert({ gw_number: 1, status: "open" })
    .select("id")
    .single()
  if (gwErr) throw gwErr
  console.log("✅ GW1 created (open)")

  // 3. Pull GW1 fixtures from football-data.org
  const fixtures = await fetchGWFixtures(1)
  for (const f of fixtures) {
    const { error } = await db.from("fixtures").upsert({
      gw_id:       gw.id,
      home_team:   f.homeTeam.shortName,
      away_team:   f.awayTeam.shortName,
      kickoff:     f.utcDate,
      fd_match_id: f.id,
    }, { onConflict: "fd_match_id" })
    if (error) throw new Error(`Fixture insert failed: ${error.message}`)
  }
  console.log(`✅ inserted ${fixtures.length} GW1 fixtures`)

  // 4. Seed a random GW1 pick order
  const order = shuffle(players)
  for (let i = 0; i < order.length; i++) {
    const { error } = await db.from("gw_pick_order").insert({
      gw_id:     gw.id,
      player_id: order[i].id,
      position:  i + 1,
    })
    if (error) throw new Error(`Pick order insert failed: ${error.message}`)
  }
  console.log(`🎲 GW1 pick order: ${order.map(p => p.name).join(" → ")}`)

  console.log("\n🏁 Season reset complete. GW1 is open.")
  console.log("   Next: run the form sync (or hit /api/cron/sync-form) to populate team form.")
}

main().catch(e => { console.error("❌", e.message ?? e); process.exit(1) })
