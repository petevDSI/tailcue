'use client'

import { useState } from 'react'
import { createPromo } from '../../actions'

const PROMO_TYPES = [
  { value: 'profit_boost', label: 'Profit boost (% on profit only)' },
  { value: 'odds_boost', label: 'Odds boost (specific market re-priced)' },
  { value: 'bonus_bet', label: 'Bonus bet / free-bet credit' },
  { value: 'risk_free', label: 'Risk-free / first-bet insurance' },
  { value: 'other', label: 'Other (logged for reference, no EV math)' },
]

const fieldLabel = 'mb-1 block text-xs font-semibold uppercase text-muted-foreground'
const fieldInput =
  'w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary'

export function PromoForm() {
  const [promoType, setPromoType] = useState('profit_boost')

  return (
    <form action={createPromo} className="space-y-4 rounded-lg border border-border bg-card p-5">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={fieldLabel}>Sportsbook</label>
          <select name="sportsbook" className={fieldInput} defaultValue="draftkings">
            <option value="draftkings">DraftKings</option>
            <option value="fanduel">FanDuel</option>
          </select>
        </div>
        <div>
          <label className={fieldLabel}>Promo type</label>
          <select name="promo_type" className={fieldInput} value={promoType} onChange={(e) => setPromoType(e.target.value)}>
            {PROMO_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className={fieldLabel}>Title</label>
        <input name="title" required placeholder='e.g. "50% Profit Boost — any NFL game"' className={fieldInput} />
      </div>

      <div>
        <label className={fieldLabel}>Description (optional)</label>
        <textarea name="description" rows={2} className={fieldInput} placeholder="Copy/paste the promo's own wording if handy." />
      </div>

      {promoType === 'profit_boost' && (
        <div>
          <label className={fieldLabel}>Boost % (on profit only)</label>
          <input name="boost_pct" type="number" step="1" min="1" max="200" placeholder="50" className={fieldInput} />
        </div>
      )}

      {promoType === 'odds_boost' && (
        <div>
          <label className={fieldLabel}>Boosted American odds</label>
          <input name="boosted_odds" type="number" step="1" placeholder="e.g. 150 or -110" className={fieldInput} />
        </div>
      )}

      {(promoType === 'bonus_bet' || promoType === 'risk_free') && (
        <div>
          <label className={fieldLabel}>{promoType === 'bonus_bet' ? 'Bonus bet face value ($)' : 'Risk-free refund amount ($)'}</label>
          <input name="bonus_amount" type="number" step="0.01" min="0" placeholder="e.g. 200" className={fieldInput} />
        </div>
      )}

      {(promoType === 'profit_boost' || promoType === 'odds_boost' || promoType === 'risk_free') && (
        <div>
          <label className={fieldLabel}>Max eligible stake ($, optional)</label>
          <input name="max_stake" type="number" step="0.01" min="0" placeholder="Leave blank if uncapped" className={fieldInput} />
        </div>
      )}

      <div>
        <label className={fieldLabel}>Applies to (free text — matched loosely against bet type)</label>
        <input
          name="applies_to"
          placeholder='e.g. "any spread", "player props", "moneyline", "any NFL game"'
          className={fieldInput}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={fieldLabel}>Starts (optional)</label>
          <input name="starts_at" type="date" className={fieldInput} />
        </div>
        <div>
          <label className={fieldLabel}>Ends (optional)</label>
          <input name="ends_at" type="date" className={fieldInput} />
        </div>
      </div>

      <div>
        <label className={fieldLabel}>Terms / restrictions (optional)</label>
        <textarea name="terms" rows={2} className={fieldInput} placeholder="Wagering requirements, redemption window, etc." />
      </div>

      <label className="flex items-center gap-2 text-sm text-foreground">
        <input name="is_active" type="checkbox" defaultChecked className="h-4 w-4 accent-primary" />
        Active now
      </label>

      <button type="submit" className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
        Add promo
      </button>
    </form>
  )
}
