const BASE = "https://api.football-data.org/v4"
const COMPETITION = "PL"

const headers = {
  "X-Auth-Token": process.env.FOOTBALL_DATA_API_KEY!,
}

export interface FDFixture {
  id: number
  homeTeam: { name: string; shortName: string }
  awayTeam: { name: string; shortName: string }
  utcDate: string
  score: {
    fullTime: { home: number | null; away: number | null }
  }
  status: string // SCHEDULED | IN_PLAY | FINISHED | etc.
}

// Fetch all fixtures for a given gameweek.
// For double gameweeks, a team can appear in 2 fixtures —
// we deduplicate by keeping only the earliest kickoff per team.
export async function fetchGWFixtures(gw: number): Promise<FDFixture[]> {
  const res = await fetch(
    `${BASE}/competitions/${COMPETITION}/matches?matchday=${gw}`,
    { headers }
  )
  if (!res.ok) throw new Error(`football-data error: ${res.status}`)

  const data = await res.json()
  const matches: FDFixture[] = data.matches

  // Deduplicate double GW: keep earliest fixture per team
  const earliest = new Map<string, FDFixture>()
  for (const m of matches) {
    for (const team of [m.homeTeam.shortName, m.awayTeam.shortName]) {
      const existing = earliest.get(team)
      if (!existing || new Date(m.utcDate) < new Date(existing.utcDate)) {
        earliest.set(team, m)
      }
    }
  }

  // Return deduplicated unique fixtures
  const seen = new Set<number>()
  return [...earliest.values()].filter(m => {
    if (seen.has(m.id)) return false
    seen.add(m.id)
    return true
  })
}

// Fetch results for a settled gameweek
export async function fetchGWResults(gw: number): Promise<FDFixture[]> {
  const fixtures = await fetchGWFixtures(gw)
  return fixtures.filter(m => m.status === "FINISHED")
}
