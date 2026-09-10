// ============================================================================
// NFL Edge Board — shared types
// Mirrors the `nfl_edge` Postgres schema (service-role only, RLS enabled
// with zero policies — see scripts/nfl-edge and the migration that created
// it). These are the shapes every lib/script/page in this feature passes
// around.
// ============================================================================

export type Conference = 'AFC' | 'NFC'
export type WeekType = 'reg' | 'post'
export type GameStatus = 'scheduled' | 'in_progress' | 'final'
export type Sportsbook = 'draftkings' | 'fanduel' | 'consensus'
export type BetCategory = 'game_su' | 'game_ats' | 'game_total' | 'player_prop'
export type Tier = 'elite' | 'strong' | 'lean' | 'pass'
export type InjuryDesignation = 'out' | 'doubtful' | 'questionable' | 'probable' | null
export type PickType = 'SU' | 'ATS' | 'TOT'
export type NewsFlagType =
  | 'distraction'
  | 'contract'
  | 'personal'
  | 'suspension_risk'
  | 'coaching_change'
  | 'other'
export type Sentiment = 'negative' | 'neutral' | 'positive'
export type PromoType = 'odds_boost' | 'bonus_bet' | 'profit_boost' | 'risk_free' | 'other'
export type BetResult = 'pending' | 'win' | 'loss' | 'push'

export interface Team {
  id: string
  name: string
  conference: Conference
  division: string
  stadium_name: string | null
  timezone: string | null
  lat: number | null
  lon: number | null
  is_dome: boolean
  espn_team_id: string | null
}

export interface Game {
  id: string
  season_year: number
  week_number: number
  week_type: WeekType
  game_time: string
  home_team_id: string
  away_team_id: string
  is_divisional: boolean
  status: GameStatus
  home_score: number | null
  away_score: number | null
  espn_event_id: string | null
  updated_at: string
}

export interface TeamRating {
  id: number
  team_id: string
  season_year: number
  as_of_week: number
  off_rating: number
  def_rating: number
  source: string
  computed_at: string
}

export interface WeatherSnapshot {
  id: number
  game_id: string
  fetched_at: string
  wind_mph: number | null
  temp_f: number | null
  precip_pct: number | null
  is_dome_or_indoor: boolean
  source: string
}

export interface Injury {
  id: number
  game_id: string
  team_id: string
  player_name: string
  position: string | null
  designation: InjuryDesignation
  practice_status: string | null
  is_qb: boolean
  note: string | null
  source: string
  updated_at: string
}

export interface MarketLine {
  id: number
  game_id: string
  sportsbook: Sportsbook
  captured_at: string
  home_spread: number | null
  home_moneyline: number | null
  away_moneyline: number | null
  total: number | null
  source: string
  /** Not a DB column — set client-side when the row came from a trial/placeholder feed. */
  is_placeholder?: boolean
}

export interface PlayerProp {
  id: number
  game_id: string
  sportsbook: string
  player_name: string
  team_id: string | null
  market: string
  line: number | null
  over_price: number | null
  under_price: number | null
  captured_at: string
  source: string
}

export interface ExpertPick {
  id: number
  game_id: string
  source_name: string
  pick_type: PickType
  pick_side: string
  note: string | null
  captured_at: string
}

export interface PlayerNewsFlag {
  id: number
  season_year: number
  week_number: number
  team_id: string | null
  player_name: string
  flag_type: NewsFlagType
  sentiment: Sentiment
  summary: string
  source_url: string | null
  captured_at: string
}

export interface Promo {
  id: number
  sportsbook: Sportsbook
  title: string
  description: string | null
  promo_type: PromoType
  applies_to: string | null
  terms: string | null
  starts_at: string | null
  ends_at: string | null
  is_active: boolean
  captured_at: string
  /** profit_boost: fractional boost on the PROFIT portion only (0.25 = 25%). Not the stake. */
  boost_pct: number | null
  /** odds_boost: the new American odds on the specific boosted market, replacing the normal market price. */
  boosted_odds: number | null
  /** bonus_bet: face value of the free-bet credit. risk_free: dollar amount refunded (usually as a bonus bet) on a loss. */
  bonus_amount: number | null
  /** Optional cap on the real-money stake eligible for the boost. Null = no stated cap. */
  max_stake: number | null
}

export interface SportsbookAccount {
  id: number
  sportsbook: Sportsbook
  bankroll: number
  updated_at: string
}

export interface BetRecommendation {
  id: number
  season_year: number
  week_number: number
  game_id: string | null
  bet_category: BetCategory
  description: string
  side: string
  model_score: number
  tier: Tier
  model_edge: number | null
  model_prob: number | null
  /** American odds actually used for this pick (whichever book got the stake, else best/only known price). Null if never priced. */
  odds: number | null
  recommended_sportsbook: Sportsbook | null
  recommended_stake: number | null
  promo_id: number | null
  generated_at: string
}

export interface BetPlaced {
  id: number
  recommendation_id: number | null
  sportsbook: string
  description: string
  stake: number
  odds: number
  potential_payout: number | null
  result: BetResult
  placed_at: string
  settled_at: string | null
}

// ── Composite shapes used by the scoring engine ────────────────────────────

export interface GameWithContext extends Game {
  home_team: Team
  away_team: Team
  home_rating: TeamRating | null
  away_rating: TeamRating | null
  weather: WeatherSnapshot | null
  injuries: Injury[]
  market_lines: MarketLine[]
  expert_picks: ExpertPick[]
  news_flags: PlayerNewsFlag[]
}

export interface GameScore {
  game_id: string
  su_pick_team_id: string
  su_model_prob: number
  su_confidence: number
  su_tier: Tier
  ats_pick_team_id: string
  ats_side_description: string
  ats_model_prob: number
  ats_confidence: number
  ats_tier: Tier
  ats_model_edge_pts: number
  tot_pick: 'over' | 'under' | null
  tot_confidence: number | null
  tot_tier: Tier | null
  projected_margin: number
  projected_total: number
  notes: string[]
}
