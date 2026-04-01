const BASE        = "https://api.football-data.org/v4"
const COMPETITION = "PL"

const headers = {
  "X-Auth-Token": process.env.FOOTBALL_DATA_API_KEY!,
}

export const TEAM_NAME_MAP: Record<string, string> = {
  "Tottenham":               "Spurs",
  "Man United":              "Man Utd",
  "Nottm Forest":            "Nott'm Forest",
  "Nottingham":              "Nott'm Forest",
  "Newcastle":               "Newcastle",
  "West Ham":                "West Ham",
  "Wolverhampton":           "Wolves",
  "Brighton Hove":           "Brighton",
  "Aston Villa":             "Aston Villa",
  "Brentford":               "Brentford",
  "Crystal Palace":          "Crystal Palace",
  "Bournemouth":             "Bournemouth",
  "Fulham":                  "Fulham",
  "Arsenal":                 "Arsenal",
  "Chelsea":                 "Chelsea",
  "Liverpool":               "Liverpool",
  "Everton":                 "Everton",
  "Leeds United":            "Leeds",
  "Burnley":                 "Burnley",
  "Sunderland":              "Sunderland",
  "Man City":                "Man City",
  "Brighton":                "Brighton",
  "Spurs":                   "Spurs",
  "Man Utd":                 "Man Utd",
  "Nott'm Forest":           "Nott'm Forest",
  "Wolves":                  "Wolves",
  "Leeds":                   "Leeds",
  "Newcastle Utd":           "Newcastle",
  "Tottenham Hotspur":       "Spurs",
  "Manchester City":         "Man City",
  "Manchester United":       "Man Utd",
  "Nottingham Forest":       "Nott'm Forest",
  "Newcastle United":        "Newcastle",
  "West Ham United FC":      "West Ham",
  "Wolverhampton Wanderers": "Wolves",
  "Brighton & Hove Albion":  "Brighton",
  "AFC Bournemouth":         "Bournemouth",
  "Leeds United FC":         "Leeds",
  "Burnley FC":              "Burnley",
  "Sunderland AFC":          "Sunderland",
}

export function normTeamName(name: string): string {
  return TEAM_NAME_MAP[name] ?? name
}

export interface FDFixture {
  id: number
  homeTeam: { name: string; shortName: string }
  awayTeam: { name: string; shortName: string }
  utcDate: string
  score: {
    fullTime: { home: number | null; away: number | null }
  }
  status: string
}

export async function fetchGWFixtures(gw: number): Promise<FDFixture[]> {
  const res = await fetch(
    `${BASE}/competitions/${COMPETITION}/matches?matchday=${gw}`,
    { headers }
  )
  if (!res.ok) throw new Error(`football-data error: ${res.status}`)

  const data = await res.json()
  const matches: FDFixture[] = data.matches.map((m: any) => ({
    ...m,
    homeTeam: { ...m.homeTeam, shortName: normTeamName(m.homeTeam.shortName) },
    awayTeam: { ...m.awayTeam, shortName: normTeamName(m.awayTeam.shortName) },
  }))

  const earliest = new Map<string, FDFixture>()
  for (const m of matches) {
    for (const team of [m.homeTeam.shortName, m.awayTeam.shortName]) {
      const existing = earliest.get(team)
      if (!existing || new Date(m.utcDate) < new Date(existing.utcDate)) {
        earliest.set(team, m)
      }
    }
  }

  const seen = new Set<number>()
  return [...earliest.values()].filter(m => {
    if (seen.has(m.id)) return false
    seen.add(m.id)
    return true
  })
}

export async function fetchGWResults(gw: number): Promise<FDFixture[]> {
  const fixtures = await fetchGWFixtures(gw)
  return fixtures.filter(m => m.status === "FINISHED")
}

export async function fetchTeamForm(fdTeamId: number, teamName: string): Promise<{ team: string; form: string[] }> {
  const res = await fetch(
    `${BASE}/teams/${fdTeamId}/matches?status=FINISHED&limit=5`,
    { headers }
  )
  if (!res.ok) throw new Error(`football-data error ${res.status} for team ${teamName}`)
  const data = await res.json()

  const form = (data.matches as any[])
    .slice(-5)
    .map((m: any) => {
      const isHome = normTeamName(m.homeTeam.shortName) === teamName
      const hs = m.score.fullTime.home
      const as_ = m.score.fullTime.away
      if (hs === as_) return "D"
      if (isHome) return hs > as_ ? "W" : "L"
      return as_ > hs ? "W" : "L"
    })

  return { team: teamName, form }
}

export const FD_TEAM_IDS: Record<string, number> = {
  "Arsenal":        57,
  "Aston Villa":    58,
  "Bournemouth":    1044,
  "Brentford":      402,
  "Brighton":       397,
  "Burnley":        328,
  "Chelsea":        61,
  "Crystal Palace": 354,
  "Everton":        62,
  "Fulham":         63,
  "Leeds":          341,
  "Liverpool":      64,
  "Man City":       65,
  "Man Utd":        66,
  "Newcastle":      67,
  "Nott'm Forest":  351,
  "Spurs":          73,
  "Sunderland":     356,
  "West Ham":       563,
  "Wolves":         76,
}
