// Populate the team_form table for every team in the league.
// Run with: DOTENV_CONFIG_PATH=.env.local npx tsx scripts/sync-form.ts
//
// Mirrors /api/cron/sync-form but runnable locally. Takes ~2.5 mins — the
// football-data.org free tier caps at 10 req/min so we wait 7s between teams.

import "dotenv/config"
import { createClient } from "@supabase/supabase-js"
import { fetchTeamForm, FD_TEAM_IDS } from "../src/lib/football-data"

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function main() {
  const entries = Object.entries(FD_TEAM_IDS)
  for (const [teamName, teamId] of entries) {
    try {
      const { team, form } = await fetchTeamForm(teamId, teamName)
      const { error } = await db
        .from("team_form")
        .upsert({ team, form, updated_at: new Date().toISOString() }, { onConflict: "team" })
      if (error) throw new Error(error.message)
      console.log(`✅ ${team}: ${form.join("") || "(no recent matches)"}`)
    } catch (e: any) {
      console.warn(`⚠️  ${teamName}: ${e.message}`)
    }
    await new Promise(r => setTimeout(r, 7000))
  }
  console.log("\n🏁 Form sync complete.")
}

main().catch(e => { console.error("❌", e.message ?? e); process.exit(1) })
