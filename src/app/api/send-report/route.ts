import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'
import { PROCEDURES } from '@/lib/seed-data'

const resend = new Resend(process.env.RESEND_API_KEY)

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type VerdictType = 'fair' | 'slightly_high' | 'high' | 'above_market'

const VERDICT_LABELS: Record<VerdictType, string> = {
  fair: 'Fair Price',
  slightly_high: 'Slightly High',
  high: 'High',
  above_market: 'Above Market',
}

const VERDICT_COLORS: Record<VerdictType, string> = {
  fair: '#15803d',
  slightly_high: '#a16207',
  high: '#c2410c',
  above_market: '#b91c1c',
}

const VERDICT_BG: Record<VerdictType, string> = {
  fair: '#f0fdf4',
  slightly_high: '#fefce8',
  high: '#fff7ed',
  above_market: '#fef2f2',
}

const VERDICT_BORDER: Record<VerdictType, string> = {
  fair: '#bbf7d0',
  slightly_high: '#fef08a',
  high: '#fed7aa',
  above_market: '#fecaca',
}

interface InsuranceEmailData {
  carrierName: string
  outOfPocket: number
  finalPayout: number
  deductibleApplied: number
  reimbursementPct: number
  isHighOutOfPocket: boolean
}

function buildEmail({
  procedureName,
  clinicalName,
  species,
  metroCode,
  quotedPrice,
  verdict,
  p50,
  p70,
  p90,
  questionsToAsk,
  insurance,
}: {
  procedureName: string
  clinicalName: string | null
  species: string
  metroCode: string | null
  quotedPrice: number
  verdict: VerdictType
  p50: number
  p70: number
  p90: number
  questionsToAsk: { question: string; listen_for: string; why_it_matters: string }[]
  insurance: InsuranceEmailData | null
}): string {
  const verdictLabel = VERDICT_LABELS[verdict]
  const verdictColor = VERDICT_COLORS[verdict]
  const verdictBg = VERDICT_BG[verdict]
  const verdictBorder = VERDICT_BORDER[verdict]

  const locationNote = metroCode
    ? `Prices shown reflect your local area (${metroCode}).`
    : 'Prices shown are national averages.'

  const questionsHtml = questionsToAsk
    .map(
      (q, i) => `
      <tr>
        <td style="padding: 6px 0; vertical-align: top; width: 28px;">
          <span style="display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 50%; background-color: #fef3c7; color: #92400e; font-size: 11px; font-weight: 700;">${i + 1}</span>
        </td>
        <td style="padding: 6px 0;">
          <div style="font-size: 14px; color: #111827; font-weight: 600; line-height: 1.5; margin-bottom: 4px;">${q.question}</div>
          <div style="font-size: 12px; color: #6b7280; line-height: 1.5; margin-bottom: 2px;"><span style="font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #d97706;">Listen For:</span> ${q.listen_for}</div>
          <div style="font-size: 12px; color: #6b7280; line-height: 1.5;"><span style="font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #d97706;">Why It Matters:</span> ${q.why_it_matters}</div>
        </td>
      </tr>`
    )
    .join('')

  const insuranceSectionHtml = insurance
    ? `
          <!-- Insurance estimate -->
          <div style="border: 1px solid #fde68a; border-radius: 10px; padding: 20px; margin-bottom: 24px; background-color: #fffbeb;">
            <h3 style="margin: 0 0 4px; font-size: 15px; font-weight: 600; color: #111827;">Your insurance estimate</h3>
            <div style="font-size: 13px; color: #92400e; margin-bottom: 16px;">${insurance.carrierName}</div>

            <div style="margin-bottom: 16px;">
              <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #92400e; margin-bottom: 4px;">Your out-of-pocket</div>
              <div style="font-size: 30px; font-weight: 800; color: #111827; line-height: 1;">$${insurance.outOfPocket.toLocaleString()}</div>
            </div>

            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding: 7px 0; font-size: 13px; color: #6b7280; border-top: 1px solid #fde68a;">Estimated payout</td>
                <td style="padding: 7px 0; font-size: 13px; font-weight: 600; color: #111827; text-align: right; border-top: 1px solid #fde68a;">$${insurance.finalPayout.toLocaleString()}</td>
              </tr>
              <tr>
                <td style="padding: 7px 0; font-size: 13px; color: #6b7280; border-top: 1px solid #fde68a;">Deductible applied</td>
                <td style="padding: 7px 0; font-size: 13px; font-weight: 600; color: #111827; text-align: right; border-top: 1px solid #fde68a;">$${insurance.deductibleApplied.toLocaleString()}</td>
              </tr>
              <tr>
                <td style="padding: 7px 0; font-size: 13px; color: #6b7280; border-top: 1px solid #fde68a;">Reimbursement rate</td>
                <td style="padding: 7px 0; font-size: 13px; font-weight: 600; color: #111827; text-align: right; border-top: 1px solid #fde68a;">${insurance.reimbursementPct}%</td>
              </tr>
            </table>

            <p style="margin: 12px 0 0; font-size: 11px; color: #9ca3af;">This is an estimate. Review your policy&#39;s exclusions section for exact terms.</p>

            ${insurance.isHighOutOfPocket ? `<p style="margin: 10px 0 0; font-size: 13px; color: #92400e; line-height: 1.5;">Your current policy may leave you with significant out-of-pocket costs. Consider comparing plans at <a href="https://www.theswiftest.com/pet-insurance/" style="color: #d97706; text-decoration: underline;">theswiftest.com/pet-insurance</a></p>` : ''}
          </div>
    `
    : ''

  const priceBarCells = [
    { label: 'Median (P50)', value: p50, bg: '#bbf7d0', color: '#14532d' },
    { label: 'Above Avg (P70)', value: p70, bg: '#fef08a', color: '#713f12' },
    { label: 'High End (P90)', value: p90, bg: '#fed7aa', color: '#7c2d12' },
  ]
    .map(
      ({ label, value, bg, color }) => `
      <td style="width: 33%; padding: 4px;">
        <div style="background-color: ${bg}; border-radius: 10px; padding: 12px 8px; text-align: center;">
          <div style="font-size: 20px; font-weight: 700; color: ${color}; line-height: 1;">$${value.toLocaleString()}</div>
          <div style="font-size: 11px; color: ${color}; margin-top: 4px; opacity: 0.8;">${label}</div>
        </div>
      </td>`
    )
    .join('')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Your VetQuoteCheck Report</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f9fafb; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; padding: 32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 560px;">

          <!-- Header -->
          <tr>
            <td style="background-color: #1d4ed8; border-radius: 12px 12px 0 0; padding: 20px 28px;">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="width: 36px; height: 36px; background-color: rgba(255,255,255,0.2); border-radius: 8px; text-align: center; vertical-align: middle; font-size: 20px;">🐾</td>
                  <td style="padding-left: 10px; font-size: 18px; font-weight: 700; color: #ffffff;">VetQuoteCheck</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background-color: #ffffff; padding: 28px; border-left: 1px solid #e5e7eb; border-right: 1px solid #e5e7eb;">

              <p style="margin: 0 0 20px; font-size: 15px; color: #6b7280;">Here's your quote analysis for <strong style="color: #111827;">${procedureName}</strong>${clinicalName ? ` <span style="font-size: 12px; color: #9ca3af;">(${clinicalName})</span>` : ''} — ${species}.</p>

              <!-- Verdict banner -->
              <div style="background-color: ${verdictBg}; border: 2px solid ${verdictBorder}; border-radius: 10px; padding: 16px 20px; margin-bottom: 24px;">
                <div style="font-size: 20px; font-weight: 800; color: ${verdictColor}; letter-spacing: -0.02em;">${verdictLabel.toUpperCase()}</div>
                <div style="margin-top: 6px; font-size: 14px; color: ${verdictColor};">
                  Your quote: <strong>$${quotedPrice.toLocaleString()}</strong>
                </div>
              </div>

              <!-- Price range -->
              <h3 style="margin: 0 0 12px; font-size: 15px; font-weight: 600; color: #111827;">Price Range Comparison</h3>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 8px;">
                <tr>${priceBarCells}</tr>
              </table>
              <p style="margin: 0 0 24px; font-size: 12px; color: #9ca3af;">${locationNote}</p>

              ${insuranceSectionHtml}

              <!-- Questions -->
              <h3 style="margin: 0 0 12px; font-size: 15px; font-weight: 600; color: #111827;">Questions to Ask Your Vet</h3>
              <table cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 24px;">
                ${questionsHtml}
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f3f4f6; border-radius: 0 0 12px 12px; border: 1px solid #e5e7eb; border-top: none; padding: 16px 28px; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #9ca3af;">
                Powered by <strong>VetQuoteCheck.com</strong> — helping pet owners understand veterinary pricing.<br />
                Benchmark prices based on NAPHIA SOI 2025 and industry data. For educational purposes only.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

export async function POST(req: NextRequest) {
  let body: {
    email?: string
    procedure_slug?: string
    species?: string
    metro_code?: string | null
    quoted_price?: number
    verdict?: string
    p50?: number
    p70?: number
    p90?: number
    submission_id?: string | null
    insurance_carrier_name?: string | null
    insurance_out_of_pocket?: number | null
    insurance_final_payout?: number | null
    insurance_deductible_applied?: number | null
    insurance_reimbursement_pct?: number | null
    insurance_is_high_out_of_pocket?: boolean | null
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const {
    email, procedure_slug, species, metro_code, quoted_price, verdict, p50, p70, p90,
    submission_id,
    insurance_carrier_name, insurance_out_of_pocket, insurance_final_payout,
    insurance_deductible_applied, insurance_reimbursement_pct, insurance_is_high_out_of_pocket,
  } = body

  if (!email || !procedure_slug || !species || quoted_price == null || !verdict || p50 == null || p70 == null || p90 == null) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const procedure = PROCEDURES.find((p) => p.slug === procedure_slug)
  if (!procedure) {
    return NextResponse.json({ error: 'Unknown procedure' }, { status: 400 })
  }

  const insuranceData: InsuranceEmailData | null =
    insurance_out_of_pocket != null &&
    insurance_final_payout != null &&
    insurance_deductible_applied != null &&
    insurance_reimbursement_pct != null &&
    insurance_is_high_out_of_pocket != null
      ? {
          carrierName: insurance_carrier_name || 'Your carrier',
          outOfPocket: insurance_out_of_pocket,
          finalPayout: insurance_final_payout,
          deductibleApplied: insurance_deductible_applied,
          reimbursementPct: insurance_reimbursement_pct,
          isHighOutOfPocket: insurance_is_high_out_of_pocket,
        }
      : null

  const html = buildEmail({
    procedureName: procedure.display_name,
    clinicalName: procedure.clinical_name ?? null,
    species,
    metroCode: metro_code ?? null,
    quotedPrice: quoted_price,
    verdict: verdict as VerdictType,
    p50,
    p70,
    p90,
    questionsToAsk: procedure.questions_to_ask,
    insurance: insuranceData,
  })

  // Send email
  const { error: sendError } = await resend.emails.send({
    from: 'VetQuoteCheck <onboarding@resend.dev>',
    to: email,
    subject: `Your Vet Quote Report — ${procedure.display_name}`,
    html,
  })

  if (sendError) {
    console.error('Resend error:', sendError)
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
  }

  // Update or insert submission record — best-effort
  try {
    if (submission_id) {
      await supabase
        .from('quote_submissions')
        .update({ email })
        .eq('id', submission_id)
    } else {
      await supabase.from('quote_submissions').insert({
        metro_code: metro_code ?? null,
        species,
        quoted_price: Math.round(quoted_price * 100),
        verdict,
        email,
      })
    }
  } catch {
    // Non-fatal — email already sent
  }

  return NextResponse.json({ ok: true })
}
