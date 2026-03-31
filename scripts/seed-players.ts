// Run with: npx tsx scripts/seed-players.ts
// Make sure .env.local is present — dotenv loads it below

import "dotenv/config"
import bcrypt from "bcryptjs"
import { createClient } from "@supabase/supabase-js"

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ── Configure your players and PINs here ──────────────────
const PLAYERS = [
  { name: "Damien", pin: "1234" },
  { name: "Tunde",  pin: "1234" },
  { name: "Gowth",  pin: "1234" },
  { name: "Dyl",    pin: "1234" },
]
// ──────────────────────────────────────────────────────────

async function main() {
  for (const p of PLAYERS) {
    const pin_hash = await bcrypt.hash(p.pin, 10)
    const { error } = await db
      .from("players")
      .upsert({ name: p.name, pin_hash }, { onConflict: "name" })
    if (error) console.error(`Error inserting ${p.name}:`, error.message)
    else console.log(`✅ Inserted ${p.name}`)
  }
}

main()
