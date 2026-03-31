// Run with: npx tsx scripts/backfill.ts
import "dotenv/config"
import { createClient } from "@supabase/supabase-js"

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const FD_API_KEY  = process.env.FOOTBALL_DATA_API_KEY!
const FD_BASE     = "https://api.football-data.org/v4"
const RATE_DELAY  = 7000 // 7s between calls — stays under 10 req/min free tier limit

// ── PLAYER MAP ────────────────────────────────────────────
// Maps pick names → canonical DB name
const NAME_MAP: Record<string, string> = {
  Damien: "Damien", Tunde: "Tunde", Gowth: "Gowth", Dyl: "Dyl",
}

// ── TEAM NAME NORMALISATION ───────────────────────────────
const TEAM_MAP: Record<string, string> = {
  "Citeh":               "Man City",
  "Cry Pal":             "Crystal Palace",
  "Palace":              "Crystal Palace",
  "Crystal Palace":      "Crystal Palace",
  "Forest":              "Nott'm Forest",
  "Nottm Forest":        "Nott'm Forest",
  "Nottingham Forest":   "Nott'm Forest",
  "Nott'm Forest":       "Nott'm Forest",
  "United":              "Man Utd",
  "Man United":          "Man Utd",
  "Man Utd":             "Man Utd",
  "Man City":            "Man City",
  "Spurs":               "Spurs",
  "Tottenham":           "Spurs",
  "Liverpool":           "Liverpool",
  "Arsenal":             "Arsenal",
  "Chelsea":             "Chelsea",
  "Brighton":            "Brighton",
  "Aston Villa":         "Aston Villa",
  "Newcastle":           "Newcastle",
  "Wolves":              "Wolves",
  "West Ham":            "West Ham",
  "Brentford":           "Brentford",
  "Fulham":              "Fulham",
  "Bournemouth":         "Bournemouth",
  "Everton":             "Everton",
  "Leeds":               "Leeds",
  "Burnley":             "Burnley",
  "Sunderland":          "Sunderland",
}

function norm(t: string): string {
  return TEAM_MAP[t.trim()] ?? t.trim()
}

// ── PICK ORDER PER GW ─────────────────────────────────────
const GW_ORDER: Record<number, string[]> = {
   1: ["Damien","Tunde","Gowth","Dyl"],
   2: ["Dyl","Gowth","Tunde","Damien"],
   3: ["Gowth","Dyl","Damien","Tunde"],
   4: ["Tunde","Damien","Dyl","Gowth"],
   5: ["Damien","Tunde","Gowth","Dyl"],
   6: ["Dyl","Gowth","Tunde","Damien"],
   7: ["Gowth","Dyl","Damien","Tunde"],
   8: ["Tunde","Damien","Dyl","Gowth"],
   9: ["Damien","Tunde","Gowth","Dyl"],
  10: ["Dyl","Gowth","Tunde","Damien"],
  11: ["Gowth","Dyl","Damien","Tunde"],
  12: ["Tunde","Damien","Dyl","Gowth"],
  13: ["Damien","Tunde","Gowth","Dyl"],
  14: ["Dyl","Gowth","Tunde","Damien"],
  15: ["Gowth","Dyl","Damien","Tunde"],
  16: ["Tunde","Damien","Dyl","Gowth"],
  17: ["Damien","Tunde","Gowth","Dyl"],
  18: ["Dyl","Gowth","Tunde","Damien"],
  19: ["Gowth","Dyl","Damien","Tunde"],
  20: ["Tunde","Damien","Dyl","Gowth"],
  21: ["Damien","Tunde","Gowth","Dyl"],
  22: ["Dyl","Gowth","Tunde","Damien"],
  23: ["Gowth","Dyl","Damien","Tunde"],
  24: ["Tunde","Damien","Dyl","Gowth"],
  25: ["Damien","Tunde","Gowth","Dyl"],
  26: ["Dyl","Gowth","Tunde","Damien"],
  27: ["Gowth","Dyl","Damien","Tunde"],
  28: ["Tunde","Damien","Dyl","Gowth"],
  29: ["Damien","Tunde","Gowth","Dyl"],
  30: ["Dyl","Gowth","Tunde","Damien"],
  31: ["Gowth","Dyl","Damien","Tunde"],
  32: ["Damien","Tunde","Gowth","Dyl"],
}

// ── HISTORICAL RESULTS (GW1–22) ───────────────────────────
// Used to match picks to fixtures and calculate points
const RESULTS: Record<number, { home: string; away: string; hs: number; as: number }[]> = {
  1:  [
    { home: "Liverpool",      away: "Bournemouth",    hs: 4, as: 2 },
    { home: "Aston Villa",    away: "Newcastle",      hs: 0, as: 0 },
    { home: "Brighton",       away: "Fulham",         hs: 1, as: 1 },
    { home: "Spurs",          away: "Burnley",        hs: 3, as: 0 },
    { home: "Sunderland",     away: "West Ham",       hs: 3, as: 0 },
    { home: "Wolves",         away: "Man City",       hs: 0, as: 4 },
    { home: "Chelsea",        away: "Crystal Palace", hs: 0, as: 0 },
    { home: "Nott'm Forest",  away: "Brentford",      hs: 3, as: 1 },
    { home: "Man Utd",        away: "Arsenal",        hs: 0, as: 1 },
    { home: "Leeds",          away: "Everton",        hs: 1, as: 0 },
  ],
  2:  [
    { home: "West Ham",       away: "Chelsea",        hs: 1, as: 5 },
    { home: "Man City",       away: "Spurs",          hs: 0, as: 2 },
    { home: "Bournemouth",    away: "Wolves",         hs: 1, as: 0 },
    { home: "Brentford",      away: "Aston Villa",    hs: 1, as: 0 },
    { home: "Burnley",        away: "Sunderland",     hs: 2, as: 0 },
    { home: "Arsenal",        away: "Leeds",          hs: 5, as: 0 },
    { home: "Crystal Palace", away: "Nott'm Forest",  hs: 1, as: 1 },
    { home: "Everton",        away: "Brighton",       hs: 2, as: 0 },
    { home: "Fulham",         away: "Man Utd",        hs: 1, as: 1 },
    { home: "Newcastle",      away: "Liverpool",      hs: 2, as: 3 },
  ],
  3:  [
    { home: "Chelsea",        away: "Fulham",         hs: 2, as: 0 },
    { home: "Man Utd",        away: "Burnley",        hs: 3, as: 2 },
    { home: "Spurs",          away: "Bournemouth",    hs: 0, as: 1 },
    { home: "Sunderland",     away: "Brentford",      hs: 2, as: 1 },
    { home: "Wolves",         away: "Everton",        hs: 2, as: 3 },
    { home: "Leeds",          away: "Newcastle",      hs: 0, as: 0 },
    { home: "Brighton",       away: "Man City",       hs: 2, as: 1 },
    { home: "Nott'm Forest",  away: "West Ham",       hs: 0, as: 3 },
    { home: "Liverpool",      away: "Arsenal",        hs: 1, as: 0 },
    { home: "Aston Villa",    away: "Crystal Palace", hs: 0, as: 3 },
  ],
  4:  [
    { home: "Arsenal",        away: "Nott'm Forest",  hs: 3, as: 0 },
    { home: "Bournemouth",    away: "Brighton",       hs: 2, as: 1 },
    { home: "Crystal Palace", away: "Sunderland",     hs: 0, as: 0 },
    { home: "Everton",        away: "Aston Villa",    hs: 0, as: 0 },
    { home: "Fulham",         away: "Leeds",          hs: 1, as: 0 },
    { home: "Newcastle",      away: "Wolves",         hs: 1, as: 0 },
    { home: "West Ham",       away: "Spurs",          hs: 0, as: 3 },
    { home: "Brentford",      away: "Chelsea",        hs: 2, as: 2 },
    { home: "Burnley",        away: "Liverpool",      hs: 0, as: 1 },
    { home: "Man City",       away: "Man Utd",        hs: 3, as: 0 },
  ],
  5:  [
    { home: "Liverpool",      away: "Everton",        hs: 2, as: 1 },
    { home: "Brighton",       away: "Spurs",          hs: 2, as: 2 },
    { home: "Burnley",        away: "Nott'm Forest",  hs: 1, as: 1 },
    { home: "West Ham",       away: "Crystal Palace", hs: 1, as: 2 },
    { home: "Wolves",         away: "Leeds",          hs: 1, as: 3 },
    { home: "Man Utd",        away: "Chelsea",        hs: 2, as: 1 },
    { home: "Fulham",         away: "Brentford",      hs: 3, as: 1 },
    { home: "Bournemouth",    away: "Newcastle",      hs: 0, as: 0 },
    { home: "Sunderland",     away: "Aston Villa",    hs: 1, as: 1 },
    { home: "Arsenal",        away: "Man City",       hs: 1, as: 1 },
  ],
  6:  [
    { home: "Brentford",      away: "Man Utd",        hs: 3, as: 1 },
    { home: "Chelsea",        away: "Brighton",       hs: 1, as: 3 },
    { home: "Crystal Palace", away: "Liverpool",      hs: 2, as: 1 },
    { home: "Leeds",          away: "Bournemouth",    hs: 2, as: 2 },
    { home: "Man City",       away: "Burnley",        hs: 5, as: 1 },
    { home: "Nott'm Forest",  away: "Sunderland",     hs: 0, as: 1 },
    { home: "Spurs",          away: "Wolves",         hs: 1, as: 1 },
    { home: "Aston Villa",    away: "Fulham",         hs: 3, as: 1 },
    { home: "Newcastle",      away: "Arsenal",        hs: 1, as: 2 },
    { home: "Everton",        away: "West Ham",       hs: 1, as: 1 },
  ],
  7:  [
    { home: "Bournemouth",    away: "Fulham",         hs: 3, as: 1 },
    { home: "Leeds",          away: "Spurs",          hs: 1, as: 2 },
    { home: "Arsenal",        away: "West Ham",       hs: 2, as: 0 },
    { home: "Man Utd",        away: "Sunderland",     hs: 2, as: 0 },
    { home: "Chelsea",        away: "Liverpool",      hs: 2, as: 1 },
    { home: "Aston Villa",    away: "Burnley",        hs: 2, as: 1 },
    { home: "Everton",        away: "Crystal Palace", hs: 2, as: 1 },
    { home: "Newcastle",      away: "Nott'm Forest",  hs: 2, as: 0 },
    { home: "Wolves",         away: "Brighton",       hs: 1, as: 1 },
    { home: "Brentford",      away: "Man City",       hs: 0, as: 1 },
  ],
  8:  [
    { home: "Nott'm Forest",  away: "Chelsea",        hs: 0, as: 3 },
    { home: "Brighton",       away: "Newcastle",      hs: 2, as: 1 },
    { home: "Burnley",        away: "Leeds",          hs: 2, as: 0 },
    { home: "Crystal Palace", away: "Bournemouth",    hs: 3, as: 3 },
    { home: "Man City",       away: "Everton",        hs: 2, as: 0 },
    { home: "Sunderland",     away: "Wolves",         hs: 2, as: 0 },
    { home: "Fulham",         away: "Arsenal",        hs: 0, as: 1 },
    { home: "Spurs",          away: "Aston Villa",    hs: 1, as: 2 },
    { home: "Liverpool",      away: "Man Utd",        hs: 1, as: 2 },
    { home: "West Ham",       away: "Brentford",      hs: 0, as: 2 },
  ],
  9:  [
    { home: "Leeds",          away: "West Ham",       hs: 2, as: 1 },
    { home: "Chelsea",        away: "Sunderland",     hs: 1, as: 2 },
    { home: "Newcastle",      away: "Fulham",         hs: 2, as: 1 },
    { home: "Man Utd",        away: "Brighton",       hs: 4, as: 2 },
    { home: "Brentford",      away: "Liverpool",      hs: 3, as: 2 },
    { home: "Arsenal",        away: "Crystal Palace", hs: 1, as: 0 },
    { home: "Aston Villa",    away: "Man City",       hs: 1, as: 0 },
    { home: "Bournemouth",    away: "Nott'm Forest",  hs: 2, as: 0 },
    { home: "Wolves",         away: "Burnley",        hs: 2, as: 3 },
    { home: "Everton",        away: "Spurs",          hs: 0, as: 3 },
  ],
  10: [
    { home: "Brighton",       away: "Leeds",          hs: 3, as: 0 },
    { home: "Burnley",        away: "Arsenal",        hs: 0, as: 2 },
    { home: "Crystal Palace", away: "Brentford",      hs: 2, as: 0 },
    { home: "Fulham",         away: "Wolves",         hs: 3, as: 0 },
    { home: "Nott'm Forest",  away: "Man Utd",        hs: 2, as: 2 },
    { home: "Spurs",          away: "Chelsea",        hs: 0, as: 1 },
    { home: "Liverpool",      away: "Aston Villa",    hs: 2, as: 0 },
    { home: "West Ham",       away: "Newcastle",      hs: 3, as: 1 },
    { home: "Man City",       away: "Bournemouth",    hs: 3, as: 1 },
    { home: "Sunderland",     away: "Everton",        hs: 1, as: 1 },
  ],
  11: [
    { home: "Spurs",          away: "Man Utd",        hs: 2, as: 2 },
    { home: "Everton",        away: "Fulham",         hs: 2, as: 0 },
    { home: "West Ham",       away: "Burnley",        hs: 3, as: 2 },
    { home: "Sunderland",     away: "Arsenal",        hs: 2, as: 2 },
    { home: "Chelsea",        away: "Wolves",         hs: 3, as: 0 },
    { home: "Aston Villa",    away: "Bournemouth",    hs: 4, as: 0 },
    { home: "Brentford",      away: "Newcastle",      hs: 3, as: 1 },
    { home: "Crystal Palace", away: "Brighton",       hs: 0, as: 0 },
    { home: "Nott'm Forest",  away: "Leeds",          hs: 3, as: 1 },
    { home: "Man City",       away: "Liverpool",      hs: 3, as: 0 },
  ],
  12: [
    { home: "Burnley",        away: "Chelsea",        hs: 0, as: 2 },
    { home: "Bournemouth",    away: "West Ham",       hs: 2, as: 2 },
    { home: "Brighton",       away: "Brentford",      hs: 2, as: 1 },
    { home: "Fulham",         away: "Sunderland",     hs: 1, as: 0 },
    { home: "Liverpool",      away: "Nott'm Forest",  hs: 0, as: 3 },
    { home: "Wolves",         away: "Crystal Palace", hs: 0, as: 2 },
    { home: "Newcastle",      away: "Man City",       hs: 2, as: 1 },
    { home: "Leeds",          away: "Aston Villa",    hs: 1, as: 2 },
    { home: "Arsenal",        away: "Spurs",          hs: 4, as: 1 },
    { home: "Man Utd",        away: "Everton",        hs: 0, as: 1 },
  ],
  13: [
    { home: "Brentford",      away: "Burnley",        hs: 3, as: 1 },
    { home: "Man City",       away: "Leeds",          hs: 3, as: 2 },
    { home: "Sunderland",     away: "Bournemouth",    hs: 3, as: 2 },
    { home: "Everton",        away: "Newcastle",      hs: 1, as: 4 },
    { home: "Spurs",          away: "Fulham",         hs: 1, as: 2 },
    { home: "Crystal Palace", away: "Man Utd",        hs: 1, as: 2 },
    { home: "Aston Villa",    away: "Wolves",         hs: 1, as: 0 },
    { home: "Nott'm Forest",  away: "Brighton",       hs: 0, as: 2 },
    { home: "West Ham",       away: "Liverpool",      hs: 0, as: 2 },
    { home: "Chelsea",        away: "Arsenal",        hs: 1, as: 1 },
  ],
  14: [
    { home: "Bournemouth",    away: "Everton",        hs: 0, as: 1 },
    { home: "Fulham",         away: "Man City",       hs: 4, as: 5 },
    { home: "Newcastle",      away: "Spurs",          hs: 2, as: 2 },
    { home: "Arsenal",        away: "Brentford",      hs: 2, as: 0 },
    { home: "Brighton",       away: "Aston Villa",    hs: 3, as: 4 },
    { home: "Burnley",        away: "Crystal Palace", hs: 0, as: 1 },
    { home: "Wolves",         away: "Nott'm Forest",  hs: 0, as: 1 },
    { home: "Leeds",          away: "Chelsea",        hs: 3, as: 1 },
    { home: "Liverpool",      away: "Sunderland",     hs: 1, as: 1 },
    { home: "Man Utd",        away: "West Ham",       hs: 1, as: 1 },
  ],
  15: [
    { home: "Aston Villa",    away: "Arsenal",        hs: 2, as: 1 },
    { home: "Bournemouth",    away: "Chelsea",        hs: 0, as: 0 },
    { home: "Everton",        away: "Nott'm Forest",  hs: 3, as: 0 },
    { home: "Man City",       away: "Sunderland",     hs: 3, as: 0 },
    { home: "Newcastle",      away: "Burnley",        hs: 2, as: 1 },
    { home: "Spurs",          away: "Brentford",      hs: 2, as: 0 },
    { home: "Leeds",          away: "Liverpool",      hs: 3, as: 3 },
    { home: "Brighton",       away: "West Ham",       hs: 1, as: 1 },
    { home: "Fulham",         away: "Crystal Palace", hs: 1, as: 2 },
    { home: "Wolves",         away: "Man Utd",        hs: 1, as: 4 },
  ],
  16: [
    { home: "Chelsea",        away: "Everton",        hs: 2, as: 0 },
    { home: "Liverpool",      away: "Brighton",       hs: 2, as: 0 },
    { home: "Burnley",        away: "Fulham",         hs: 2, as: 3 },
    { home: "Arsenal",        away: "Wolves",         hs: 2, as: 1 },
    { home: "Crystal Palace", away: "Man City",       hs: 0, as: 3 },
    { home: "Nott'm Forest",  away: "Spurs",          hs: 3, as: 0 },
    { home: "Sunderland",     away: "Newcastle",      hs: 1, as: 0 },
    { home: "West Ham",       away: "Aston Villa",    hs: 2, as: 3 },
    { home: "Brentford",      away: "Leeds",          hs: 1, as: 1 },
    { home: "Man Utd",        away: "Bournemouth",    hs: 4, as: 4 },
  ],
  17: [
    { home: "Newcastle",      away: "Chelsea",        hs: 2, as: 2 },
    { home: "Bournemouth",    away: "Burnley",        hs: 1, as: 1 },
    { home: "Brighton",       away: "Sunderland",     hs: 0, as: 0 },
    { home: "Man City",       away: "West Ham",       hs: 3, as: 0 },
    { home: "Wolves",         away: "Brentford",      hs: 0, as: 2 },
    { home: "Spurs",          away: "Liverpool",      hs: 1, as: 2 },
    { home: "Everton",        away: "Arsenal",        hs: 0, as: 1 },
    { home: "Leeds",          away: "Crystal Palace", hs: 4, as: 1 },
    { home: "Aston Villa",    away: "Man Utd",        hs: 2, as: 1 },
    { home: "Fulham",         away: "Nott'm Forest",  hs: 1, as: 0 },
  ],
  18: [
    { home: "Man Utd",        away: "Newcastle",      hs: 1, as: 0 },
    { home: "Nott'm Forest",  away: "Man City",       hs: 1, as: 2 },
    { home: "Arsenal",        away: "Brighton",       hs: 2, as: 1 },
    { home: "Brentford",      away: "Bournemouth",    hs: 4, as: 1 },
    { home: "Burnley",        away: "Everton",        hs: 0, as: 0 },
    { home: "Liverpool",      away: "Wolves",         hs: 2, as: 1 },
    { home: "West Ham",       away: "Fulham",         hs: 0, as: 1 },
    { home: "Chelsea",        away: "Aston Villa",    hs: 1, as: 2 },
    { home: "Sunderland",     away: "Leeds",          hs: 1, as: 1 },
    { home: "Crystal Palace", away: "Spurs",          hs: 0, as: 1 },
  ],
  19: [
    { home: "Burnley",        away: "Newcastle",      hs: 1, as: 3 },
    { home: "Chelsea",        away: "Bournemouth",    hs: 2, as: 2 },
    { home: "Nott'm Forest",  away: "Everton",        hs: 0, as: 2 },
    { home: "West Ham",       away: "Brighton",       hs: 2, as: 2 },
    { home: "Arsenal",        away: "Aston Villa",    hs: 4, as: 1 },
    { home: "Man Utd",        away: "Wolves",         hs: 1, as: 1 },
    { home: "Crystal Palace", away: "Fulham",         hs: 1, as: 1 },
    { home: "Liverpool",      away: "Leeds",          hs: 0, as: 0 },
    { home: "Brentford",      away: "Spurs",          hs: 0, as: 0 },
    { home: "Sunderland",     away: "Man City",       hs: 0, as: 0 },
  ],
  20: [
    { home: "Aston Villa",    away: "Nott'm Forest",  hs: 3, as: 1 },
    { home: "Brighton",       away: "Burnley",        hs: 2, as: 0 },
    { home: "Wolves",         away: "West Ham",       hs: 3, as: 0 },
    { home: "Bournemouth",    away: "Arsenal",        hs: 2, as: 3 },
    { home: "Leeds",          away: "Man Utd",        hs: 1, as: 1 },
    { home: "Everton",        away: "Brentford",      hs: 2, as: 4 },
    { home: "Fulham",         away: "Liverpool",      hs: 2, as: 2 },
    { home: "Newcastle",      away: "Crystal Palace", hs: 2, as: 0 },
    { home: "Spurs",          away: "Sunderland",     hs: 1, as: 1 },
    { home: "Man City",       away: "Chelsea",        hs: 1, as: 1 },
  ],
  21: [
    { home: "West Ham",       away: "Nott'm Forest",  hs: 1, as: 2 },
    { home: "Bournemouth",    away: "Spurs",          hs: 3, as: 2 },
    { home: "Brentford",      away: "Sunderland",     hs: 3, as: 0 },
    { home: "Crystal Palace", away: "Aston Villa",    hs: 0, as: 0 },
    { home: "Everton",        away: "Wolves",         hs: 1, as: 1 },
    { home: "Fulham",         away: "Chelsea",        hs: 2, as: 1 },
    { home: "Man City",       away: "Brighton",       hs: 1, as: 1 },
    { home: "Burnley",        away: "Man Utd",        hs: 2, as: 2 },
    { home: "Newcastle",      away: "Leeds",          hs: 4, as: 3 },
    { home: "Arsenal",        away: "Liverpool",      hs: 0, as: 0 },
  ],
  22: [
    { home: "Man Utd",        away: "Man City",       hs: 2, as: 0 },
    { home: "Chelsea",        away: "Brentford",      hs: 2, as: 0 },
    { home: "Leeds",          away: "Fulham",         hs: 1, as: 0 },
    { home: "Liverpool",      away: "Burnley",        hs: 1, as: 1 },
    { home: "Spurs",          away: "West Ham",       hs: 1, as: 2 },
    { home: "Sunderland",     away: "Crystal Palace", hs: 2, as: 1 },
    { home: "Nott'm Forest",  away: "Arsenal",        hs: 0, as: 0 },
    { home: "Wolves",         away: "Newcastle",      hs: 0, as: 0 },
    { home: "Aston Villa",    away: "Everton",        hs: 0, as: 1 },
    { home: "Brighton",       away: "Bournemouth",    hs: 1, as: 1 },
  ],
}

// ── PICKS ─────────────────────────────────────────────────
interface Pick {
  gw: number
  player: string
  team: string        // team picked to win
  predHome: number
  predAway: number
  predWinner: string  // explicit winner pick (may differ from score implication)
}

const PICKS: Pick[] = [
  // GW1
  { gw:  1, player: "Damien", team: "Sunderland",     predWinner: "Sunderland",     predHome: 2, predAway: 1 },
  { gw:  1, player: "Tunde",  team: "Spurs",           predWinner: "Spurs",           predHome: 2, predAway: 1 },
  { gw:  1, player: "Gowth",  team: "Liverpool",       predWinner: "Liverpool",       predHome: 3, predAway: 1 },
  { gw:  1, player: "Dyl",    team: "Brighton",        predWinner: "Brighton",        predHome: 2, predAway: 1 },
  // GW2
  { gw:  2, player: "Dyl",    team: "Arsenal",         predWinner: "Arsenal",         predHome: 3, predAway: 0 },
  { gw:  2, player: "Gowth",  team: "Bournemouth",     predWinner: "Bournemouth",     predHome: 2, predAway: 1 },
  { gw:  2, player: "Tunde",  team: "Chelsea",         predWinner: "Chelsea",         predHome: 3, predAway: 1 },
  { gw:  2, player: "Damien", team: "Aston Villa",     predWinner: "Aston Villa",     predHome: 2, predAway: 1 },
  // GW3
  { gw:  3, player: "Gowth",  team: "Nott'm Forest",  predWinner: "Nott'm Forest",   predHome: 3, predAway: 1 },
  { gw:  3, player: "Dyl",    team: "Newcastle",       predWinner: "Newcastle",       predHome: 3, predAway: 1 },
  { gw:  3, player: "Damien", team: "Spurs",           predWinner: "Spurs",           predHome: 2, predAway: 0 },
  { gw:  3, player: "Tunde",  team: "Man Utd",         predWinner: "Man Utd",         predHome: 2, predAway: 1 },
  // GW4
  { gw:  4, player: "Tunde",  team: "Liverpool",       predWinner: "Liverpool",       predHome: 2, predAway: 0 },
  { gw:  4, player: "Damien", team: "Crystal Palace",  predWinner: "Crystal Palace",  predHome: 2, predAway: 1 },
  { gw:  4, player: "Dyl",    team: "Fulham",          predWinner: "Fulham",          predHome: 2, predAway: 1 },
  { gw:  4, player: "Gowth",  team: "Newcastle",       predWinner: "Newcastle",       predHome: 2, predAway: 0 },
  // GW5
  { gw:  5, player: "Damien", team: "Fulham",          predWinner: "Fulham",          predHome: 2, predAway: 0 },
  { gw:  5, player: "Tunde",  team: "Crystal Palace",  predWinner: "Crystal Palace",  predHome: 2, predAway: 1 },
  { gw:  5, player: "Gowth",  team: "Leeds",           predWinner: "Leeds",           predHome: 2, predAway: 1 },
  { gw:  5, player: "Dyl",    team: "Nott'm Forest",   predWinner: "Nott'm Forest",   predHome: 2, predAway: 0 },
  // GW6
  { gw:  6, player: "Dyl",    team: "Everton",         predWinner: "Everton",         predHome: 3, predAway: 0 },
  { gw:  6, player: "Gowth",  team: "Spurs",           predWinner: "Spurs",           predHome: 3, predAway: 1 },
  { gw:  6, player: "Tunde",  team: "Man City",        predWinner: "Man City",        predHome: 2, predAway: 0 },
  { gw:  6, player: "Damien", team: "Nott'm Forest",   predWinner: "Nott'm Forest",   predHome: 2, predAway: 1 },
  // GW7
  { gw:  7, player: "Gowth",  team: "Arsenal",         predWinner: "Arsenal",         predHome: 3, predAway: 1 },
  { gw:  7, player: "Dyl",    team: "Aston Villa",     predWinner: "Aston Villa",     predHome: 2, predAway: 1 },
  { gw:  7, player: "Damien", team: "Brighton",        predWinner: "Brighton",        predHome: 3, predAway: 1 },
  { gw:  7, player: "Tunde",  team: "Newcastle",       predWinner: "Newcastle",       predHome: 2, predAway: 1 },
  // GW8
  { gw:  8, player: "Tunde",  team: "Leeds",           predWinner: "Leeds",           predHome: 2, predAway: 1 },
  { gw:  8, player: "Damien", team: "Burnley",         predWinner: "Burnley",         predHome: 2, predAway: 1 },
  { gw:  8, player: "Dyl",    team: "Chelsea",         predWinner: "Chelsea",         predHome: 2, predAway: 1 },
  { gw:  8, player: "Gowth",  team: "Sunderland",      predWinner: "Sunderland",      predHome: 2, predAway: 0 },
  // GW9
  { gw:  9, player: "Damien", team: "Leeds",           predWinner: "Leeds",           predHome: 2, predAway: 1 },
  { gw:  9, player: "Tunde",  team: "Arsenal",         predWinner: "Arsenal",         predHome: 2, predAway: 0 },
  { gw:  9, player: "Gowth",  team: "Wolves",          predWinner: "Wolves",          predHome: 1, predAway: 0 },
  { gw:  9, player: "Dyl",    team: "Burnley",         predWinner: "Burnley",         predHome: 2, predAway: 1 },
  // GW10
  { gw: 10, player: "Dyl",    team: "Man Utd",         predWinner: "Man Utd",         predHome: 2, predAway: 1 },
  { gw: 10, player: "Gowth",  team: "Crystal Palace",  predWinner: "Crystal Palace",  predHome: 3, predAway: 2 },
  { gw: 10, player: "Tunde",  team: "Fulham",          predWinner: "Fulham",          predHome: 2, predAway: 1 },
  { gw: 10, player: "Damien", team: "Newcastle",       predWinner: "Newcastle",       predHome: 2, predAway: 0 },
  // GW11
  { gw: 11, player: "Gowth",  team: "Chelsea",         predWinner: "Chelsea",         predHome: 2, predAway: 0 },
  { gw: 11, player: "Dyl",    team: "Crystal Palace",  predWinner: "Crystal Palace",  predHome: 2, predAway: 1 },
  { gw: 11, player: "Damien", team: "Arsenal",         predWinner: "Arsenal",         predHome: 2, predAway: 0 },
  { gw: 11, player: "Tunde",  team: "West Ham",        predWinner: "West Ham",        predHome: 2, predAway: 1 },
  // GW12
  { gw: 12, player: "Tunde",  team: "Aston Villa",     predWinner: "Aston Villa",     predHome: 2, predAway: 1 },
  { gw: 12, player: "Damien", team: "Bournemouth",     predWinner: "Bournemouth",     predHome: 2, predAway: 1 },
  { gw: 12, player: "Dyl",    team: "Liverpool",       predWinner: "Liverpool",       predHome: 2, predAway: 1 },

  // GW13
  { gw: 13, player: "Damien", team: "West Ham",        predWinner: "West Ham",        predHome: 2, predAway: 1 },
  { gw: 13, player: "Tunde",  team: "Brentford",       predWinner: "Brentford",       predHome: 2, predAway: 1 },
  { gw: 13, player: "Gowth",  team: "Man City",        predWinner: "Man City",        predHome: 3, predAway: 0 },
  { gw: 13, player: "Dyl",    team: "Bournemouth",     predWinner: "Bournemouth",     predHome: 2, predAway: 1 },
  // GW14
  { gw: 14, player: "Dyl",    team: "Man City",        predWinner: "Man City",        predHome: 3, predAway: 1 },
  { gw: 14, player: "Gowth",  team: "Man Utd",         predWinner: "Man Utd",         predHome: 3, predAway: 1 },
  { gw: 14, player: "Tunde",  team: "Nott'm Forest",   predWinner: "Nott'm Forest",   predHome: 2, predAway: 1 },
  { gw: 14, player: "Damien", team: "Chelsea",         predWinner: "Chelsea",         predHome: 3, predAway: 0 },
  // GW15
  { gw: 15, player: "Gowth",  team: "Brighton",        predWinner: "Brighton",        predHome: 3, predAway: 2 },
  { gw: 15, player: "Dyl",    team: "Spurs",           predWinner: "Spurs",           predHome: 2, predAway: 1 },
  { gw: 15, player: "Damien", team: "Man Utd",         predWinner: "Man Utd",         predHome: 2, predAway: 0 },
  { gw: 15, player: "Tunde",  team: "Everton",         predWinner: "Everton",         predHome: 1, predAway: 0 },
  // GW16
  { gw: 16, player: "Tunde",  team: "Burnley",         predWinner: "Burnley",         predHome: 2, predAway: 1 },
  { gw: 16, player: "Damien", team: "Liverpool",       predWinner: "Liverpool",       predHome: 2, predAway: 1 },
  { gw: 16, player: "Dyl",    team: "Brentford",       predWinner: "Brentford",       predHome: 3, predAway: 1 },
  { gw: 16, player: "Gowth",  team: "Aston Villa",     predWinner: "Aston Villa",     predHome: 3, predAway: 1 },
  // GW17
  { gw: 17, player: "Damien", team: "Man City",        predWinner: "Man City",        predHome: 3, predAway: 0 },
  { gw: 17, player: "Tunde",  team: "Bournemouth",     predWinner: "Bournemouth",     predHome: 2, predAway: 1 },
  { gw: 17, player: "Gowth",  team: "Brentford",       predWinner: "Brentford",       predHome: 2, predAway: 0 },
  { gw: 17, player: "Dyl",    team: "Leeds",           predWinner: "Leeds",           predHome: 2, predAway: 1 },
  // GW18
  { gw: 18, player: "Dyl",    team: "Sunderland",      predWinner: "Sunderland",      predHome: 3, predAway: 2 },
  { gw: 18, player: "Gowth",  team: "Fulham",          predWinner: "Fulham",          predHome: 2, predAway: 1 },
  { gw: 18, player: "Tunde",  team: "Wolves",          predWinner: "Wolves",          predHome: 2, predAway: 1 },
  { gw: 18, player: "Damien", team: "Everton",         predWinner: "Everton",         predHome: 2, predAway: 0 },
  // GW19 — score/winner splits noted
  { gw: 19, player: "Gowth",  team: "Everton",         predWinner: "Everton",         predHome: 2, predAway: 1 },
  { gw: 19, player: "Dyl",    team: "Brighton",        predWinner: "Brighton",        predHome: 0, predAway: 1 }, // score implies West Ham win
  { gw: 19, player: "Damien", team: "Brentford",       predWinner: "Brentford",       predHome: 2, predAway: 2 }, // score implies draw
  { gw: 19, player: "Tunde",  team: "Brighton",        predWinner: "Brighton",        predHome: 1, predAway: 0 },
  // GW20
  { gw: 20, player: "Tunde",  team: "Brighton",        predWinner: "Brighton",        predHome: 2, predAway: 1 },
  { gw: 20, player: "Damien", team: "West Ham",        predWinner: "West Ham",        predHome: 2, predAway: 1 },
  { gw: 20, player: "Dyl",    team: "Aston Villa",     predWinner: "Aston Villa",     predHome: 2, predAway: 0 },
  { gw: 20, player: "Gowth",  team: "Newcastle",       predWinner: "Newcastle",       predHome: 2, predAway: 1 },
  // GW21
  { gw: 21, player: "Damien", team: "Everton",         predWinner: "Everton",         predHome: 2, predAway: 0 },
  { gw: 21, player: "Tunde",  team: "Man Utd",         predWinner: "Man Utd",         predHome: 2, predAway: 0 },
  { gw: 21, player: "Gowth",  team: "Man City",        predWinner: "Man City",        predHome: 2, predAway: 1 },
  { gw: 21, player: "Dyl",    team: "Newcastle",       predWinner: "Newcastle",       predHome: 2, predAway: 1 },
  // GW22
  { gw: 22, player: "Dyl",    team: "Liverpool",       predWinner: "Liverpool",       predHome: 3, predAway: 0 },
  { gw: 22, player: "Gowth",  team: "Arsenal",         predWinner: "Arsenal",         predHome: 3, predAway: 1 },
  { gw: 22, player: "Tunde",  team: "Spurs",           predWinner: "Spurs",           predHome: 2, predAway: 0 },
  { gw: 22, player: "Damien", team: "Aston Villa",     predWinner: "Aston Villa",     predHome: 2, predAway: 0 },
  // GW23
  { gw: 23, player: "Gowth",  team: "Brentford",       predWinner: "Brentford",       predHome: 2, predAway: 0 },
  { gw: 23, player: "Dyl",    team: "Man City",        predWinner: "Man City",        predHome: 3, predAway: 1 },
  { gw: 23, player: "Damien", team: "Chelsea",         predWinner: "Chelsea",         predHome: 2, predAway: 1 },
  { gw: 23, player: "Tunde",  team: "Sunderland",      predWinner: "Sunderland",      predHome: 2, predAway: 1 },
  // GW24
  { gw: 24, player: "Tunde",  team: "Arsenal",         predWinner: "Arsenal",         predHome: 2, predAway: 0 },
  { gw: 24, player: "Damien", team: "Man Utd",         predWinner: "Man Utd",         predHome: 2, predAway: 1 },
  { gw: 24, player: "Dyl",    team: "Chelsea",         predWinner: "Chelsea",         predHome: 2, predAway: 1 },
  { gw: 24, player: "Gowth",  team: "Sunderland",      predWinner: "Sunderland",      predHome: 2, predAway: 0 },
  // GW25
  { gw: 25, player: "Damien", team: "Arsenal",         predWinner: "Arsenal",         predHome: 3, predAway: 0 },
  { gw: 25, player: "Tunde",  team: "West Ham",        predWinner: "West Ham",        predHome: 2, predAway: 1 },
  { gw: 25, player: "Gowth",  team: "Chelsea",         predWinner: "Chelsea",         predHome: 3, predAway: 1 },
  { gw: 25, player: "Dyl",    team: "Man Utd",         predWinner: "Man Utd",         predHome: 3, predAway: 2 },
  // GW26
  { gw: 26, player: "Dyl",    team: "Crystal Palace",  predWinner: "Crystal Palace",  predHome: 2, predAway: 0 },
  { gw: 26, player: "Gowth",  team: "Nott'm Forest",   predWinner: "Nott'm Forest",   predHome: 2, predAway: 1 },
  { gw: 26, player: "Tunde",  team: "Aston Villa",     predWinner: "Aston Villa",     predHome: 2, predAway: 1 },
  { gw: 26, player: "Damien", team: "Liverpool",       predWinner: "Liverpool",       predHome: 2, predAway: 1 },
  // GW27
  { gw: 27, player: "Gowth",  team: "Crystal Palace",  predWinner: "Crystal Palace",  predHome: 2, predAway: 0 },
  { gw: 27, player: "Dyl",    team: "Brentford",       predWinner: "Brentford",       predHome: 2, predAway: 1 },
  { gw: 27, player: "Damien", team: "Man City",        predWinner: "Man City",        predHome: 2, predAway: 0 },
  { gw: 27, player: "Tunde",  team: "Chelsea",         predWinner: "Chelsea",         predHome: 3, predAway: 0 },
  // GW28
  { gw: 28, player: "Tunde",  team: "Brentford",       predWinner: "Brentford",       predHome: 2, predAway: 1 },
  { gw: 28, player: "Damien", team: "Bournemouth",     predWinner: "Bournemouth",     predHome: 2, predAway: 1 },
  { gw: 28, player: "Dyl",    team: "Brighton",        predWinner: "Brighton",        predHome: 2, predAway: 1 },
  { gw: 28, player: "Gowth",  team: "Liverpool",       predWinner: "Liverpool",       predHome: 2, predAway: 1 },
  // GW29
  { gw: 29, player: "Damien", team: "Fulham",          predWinner: "Fulham",          predHome: 2, predAway: 1 },
  { gw: 29, player: "Tunde",  team: "Everton",         predWinner: "Everton",         predHome: 2, predAway: 1 },
  { gw: 29, player: "Gowth",  team: "Leeds",           predWinner: "Leeds",           predHome: 3, predAway: 1 },
  { gw: 29, player: "Dyl",    team: "Sunderland",      predWinner: "Sunderland",      predHome: 2, predAway: 1 },
  // GW30
  { gw: 30, player: "Dyl",    team: "Fulham",          predWinner: "Fulham",          predHome: 2, predAway: 0 },
  { gw: 30, player: "Gowth",  team: "Man Utd",         predWinner: "Man Utd",         predHome: 3, predAway: 2 },
  { gw: 30, player: "Tunde",  team: "Bournemouth",     predWinner: "Bournemouth",     predHome: 2, predAway: 0 },
  { gw: 30, player: "Damien", team: "Nott'm Forest",   predWinner: "Nott'm Forest",   predHome: 2, predAway: 1 },
  // GW31
  { gw: 31, player: "Gowth",  team: "Fulham",          predWinner: "Fulham",          predHome: 2, predAway: 1 },
  { gw: 31, player: "Dyl",    team: "Leeds",           predWinner: "Leeds",           predHome: 2, predAway: 1 },
  { gw: 31, player: "Damien", team: "Newcastle",       predWinner: "Newcastle",       predHome: 2, predAway: 0 },
  { gw: 31, player: "Tunde",  team: "Burnley",         predWinner: "Burnley",         predHome: 1, predAway: 1 }, // score implies draw, winner = Burnley
]

// ── POINTS CALCULATION ────────────────────────────────────
function calcPoints(pick: Pick, hs: number, as_: number, home: string, away: string): number {
  const actualWinner = hs > as_ ? home : as_ > hs ? away : null
  const winnerCorrect = actualWinner !== null && norm(pick.predWinner) === actualWinner
  // Pred score is always "picked team goals - opposition goals", so flip if away
  const pickedIsHome = norm(pick.predWinner) === home
  const normHome = pickedIsHome ? pick.predHome : pick.predAway
  const normAway = pickedIsHome ? pick.predAway : pick.predHome
  const scoreCorrect = normHome === hs && normAway === as_
  return (winnerCorrect ? 1 : 0) + (scoreCorrect ? 1 : 0)
}

// ── FIND FIXTURE FOR A PICK ───────────────────────────────
function findFixture(gw: number, team: string) {
  const t = norm(team)
  return (RESULTS[gw] ?? []).find(f => f.home === t || f.away === t)
}

// ── FETCH GW RESULTS FROM FOOTBALL-DATA.ORG ──────────────
async function fetchFDResults(gw: number) {
  const res = await fetch(
    `https://api.football-data.org/v4/competitions/PL/matches?matchday=${gw}`,
    { headers: { "X-Auth-Token": FD_API_KEY } }
  )
  if (!res.ok) throw new Error(`FD API error ${res.status} for GW${gw}`)
  const data = await res.json()

  // Normalise team names from FD to match our convention
  // Map using shortName first, fall back to name
  const FD_TEAM_MAP: Record<string, string> = {
    // short names (what the API actually returns)
    "Tottenham":       "Spurs",
    "Man City":        "Man City",
    "Man United":      "Man Utd",
    "Nottm Forest":    "Nott'm Forest",
    "Nottingham":      "Nott'm Forest",
    "Newcastle":       "Newcastle",
    "West Ham":        "West Ham",
    "Wolverhampton":   "Wolves",
    "Brighton Hove":   "Brighton",
    "Aston Villa":     "Aston Villa",
    "Brentford":       "Brentford",
    "Crystal Palace":  "Crystal Palace",
    "Bournemouth":     "Bournemouth",
    "Fulham":          "Fulham",
    "Arsenal":         "Arsenal",
    "Chelsea":         "Chelsea",
    "Liverpool":       "Liverpool",
    "Everton":         "Everton",
    "Leeds United":    "Leeds",
    "Burnley":         "Burnley",
    "Sunderland":      "Sunderland",
    // full names as fallback
    "Tottenham Hotspur":        "Spurs",
    "Manchester City":          "Man City",
    "Manchester United":        "Man Utd",
    "Nottingham Forest":        "Nott'm Forest",
    "Newcastle United":         "Newcastle",
    "West Ham United FC":       "West Ham",
    "Wolverhampton Wanderers":  "Wolves",
    "Brighton & Hove Albion":   "Brighton",
    "AFC Bournemouth":          "Bournemouth",
    "Leeds United FC":          "Leeds",
    "Burnley FC":               "Burnley",
    "Sunderland AFC":           "Sunderland",
  }

  return data.matches
    .filter((m: any) => m.status === "FINISHED")
    .map((m: any) => ({
      home: FD_TEAM_MAP[m.homeTeam.shortName] ?? FD_TEAM_MAP[m.homeTeam.name] ?? m.homeTeam.shortName,
      away: FD_TEAM_MAP[m.awayTeam.shortName] ?? FD_TEAM_MAP[m.awayTeam.name] ?? m.awayTeam.shortName,
      hs:   m.score.fullTime.home as number,
      as:   m.score.fullTime.away as number,
    }))
}

// ── MAIN ──────────────────────────────────────────────────
async function main() {
  // Load players
  const { data: players, error: pErr } = await db.from("players").select("id, name")
  if (pErr) throw pErr
  const playerMap = Object.fromEntries(players!.map(p => [p.name, p.id]))

  const allGWs = [...new Set(PICKS.map(p => p.gw))].sort((a, b) => a - b)

  // Fetch ALL GW results from API (source of truth)
  console.log("Fetching all GW results from football-data.org (7s between calls, ~4 mins total)...")
  const fdResults: Record<number, { home: string; away: string; hs: number; as: number }[]> = {}
  for (const gw of allGWs) {
    try {
      fdResults[gw] = await fetchFDResults(gw)
      process.stdout.write(`  ✅ GW${gw}: ${fdResults[gw].length} results — waiting 7s...`)
      await new Promise(r => setTimeout(r, RATE_DELAY))
      process.stdout.write(` done\n`)
    } catch (e: any) {
      console.warn(`  ⚠️  GW${gw}: ${e.message}`)
      fdResults[gw] = []
    }
  }

  for (const gw of allGWs) {
    const isCurrentGW = gw === 32
    const status = gw < 32 ? "settled" : "open"

    // Upsert gameweek
    const { data: gwRow, error: gwErr } = await db
      .from("gameweeks")
      .upsert({ gw_number: gw, status }, { onConflict: "gw_number" })
      .select("id").single()
    if (gwErr) { console.error(`GW${gw}:`, gwErr.message); continue }
    const gwId = gwRow.id

    // Upsert pick order
    const order = GW_ORDER[gw]
    if (order) {
      for (let i = 0; i < order.length; i++) {
        await db.from("gw_pick_order").upsert(
          { gw_id: gwId, player_id: playerMap[order[i]], position: i + 1 },
          { onConflict: "gw_id,player_id" }
        )
      }
    }

    // Get results for this GW
    const gwResults = gw <= 22 ? (RESULTS[gw] ?? []) : (fdResults[gw] ?? [])
    const gwPicks   = PICKS.filter(p => p.gw === gw)

    for (const pick of gwPicks) {
      const team = norm(pick.team)
      const fix  = gwResults.find(f => f.home === team || f.away === team)

      // Upsert fixture
      let fixtureId: string
      if (fix) {
        const { data: f, error: fErr } = await db
          .from("fixtures")
          .upsert({
            gw_id:      gwId,
            home_team:  fix.home,
            away_team:  fix.away,
            kickoff:    `${2025 + Math.floor((gw - 1) / 38)}-01-01T15:00:00Z`, // placeholder
            home_score: fix.hs,
            away_score: fix.as,
          }, { onConflict: "gw_id,home_team,away_team" } as never)
          .select("id").single()
        if (fErr) { console.error(`Fixture error GW${gw}:`, fErr.message); continue }
        fixtureId = f.id
      } else {
        console.warn(`  ⚠️  No fixture found for ${team} in GW${gw}`)
        continue
      }

      // Calculate points
      const pts = fix ? calcPoints(pick, fix.hs, fix.as, fix.home, fix.away) : null

      // Upsert pick
      const { error: pickErr } = await db.from("picks").upsert({
        player_id:      playerMap[pick.player],
        gw_id:          gwId,
        fixture_id:     fixtureId,
        team_picked:    team,
        pred_winner:    norm(pick.predWinner),
        pred_home:      pick.predHome,
        pred_away:      pick.predAway,
        points_awarded: gw < 32 ? pts : null,
      }, { onConflict: "player_id,gw_id" })

      if (pickErr) console.error(`Pick error ${pick.player} GW${gw}:`, pickErr.message)
      else console.log(`  ✅ GW${gw} ${pick.player} → ${team} (${pick.predHome}-${pick.predAway}) = ${pts ?? "pending"}pts`)
    }

    console.log(`✅ GW${gw} done`)
  }

  console.log("\n🏁 Backfill complete!")
}

main().catch(console.error)
