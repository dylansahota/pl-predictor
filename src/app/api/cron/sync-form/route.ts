import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"
import { fetchTeamForm, FD_TEAM_IDS } from "@/lib/football-data"

// Standalone form sync — call manually or via cron
// Takes ~2.5 mins due to rate limiting
export async function GET() {
  const results: Record<string, string> = {}

  for (const [teamName, teamId] of Object.entries(FD_TEAM_IDS)) {
    try {
      const { team, form } = await fetchTeamForm(teamId, teamName)
      await supabaseAdmin
        .from("team_form")
        .upsert({ team, form, updated_at: new Date().toISOString() }, { onConflict: "team" })
      results[team] = form.join("")
      console.log(`✅ ${team}: ${form.join("")}`)
    } catch (e: any) {
      console.warn(`⚠️  ${teamName}: ${e.message}`)
      results[teamName] = "error"
    }
    await new Promise(r => setTimeout(r, 7000))
  }

  return NextResponse.json({ ok: true, results })
}
