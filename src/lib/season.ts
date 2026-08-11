// Season-wide config for the "can't reuse a team you've already picked" rule.

// The gameweek at which each player's used-team history resets, so teams free
// up again for the second half of the season. Picks in gameweeks before this
// no longer count against you from this gameweek onward. Set to null to never
// reset (a team is then off-limits to a player for the whole season).
export const TEAM_REUSE_RESET_GW: number | null = 20

// The earliest gameweek whose picks count toward a player's "teams already
// used" for the given open gameweek. Before the reset we look back to GW1;
// from the reset gameweek onward we only look back to the reset.
export function reuseWindowStart(openGwNumber: number): number {
  if (TEAM_REUSE_RESET_GW !== null && openGwNumber >= TEAM_REUSE_RESET_GW) {
    return TEAM_REUSE_RESET_GW
  }
  return 1
}
