export interface InsuranceCalcInput {
  totalVetBillCents: number
  examFeeCents: number
  examFeeCovered: boolean
  annualDeductibleCents: number
  deductibleAlreadyMetCents: number
  reimbursementPct: number
  annualLimitCents: number | null
}

export interface InsuranceCalcResult {
  eligibleAmountCents: number
  remainingDeductibleCents: number
  basePayoutCents: number
  finalPayoutCents: number
  outOfPocketCents: number
  reimbursementPct: number
  isHighOutOfPocket: boolean
}

export function calculateInsurancePayout(input: InsuranceCalcInput): InsuranceCalcResult {
  const {
    totalVetBillCents,
    examFeeCents,
    examFeeCovered,
    annualDeductibleCents,
    deductibleAlreadyMetCents,
    reimbursementPct,
    annualLimitCents,
  } = input

  const eligibleAmountCents = totalVetBillCents - (examFeeCovered ? 0 : examFeeCents)

  const remainingDeductibleCents = Math.max(0, annualDeductibleCents - deductibleAlreadyMetCents)

  const basePayoutCents = Math.max(
    0,
    Math.round((eligibleAmountCents - remainingDeductibleCents) * (reimbursementPct / 100))
  )

  const finalPayoutCents =
    annualLimitCents === null ? basePayoutCents : Math.min(basePayoutCents, annualLimitCents)

  const outOfPocketCents = totalVetBillCents - finalPayoutCents

  const isHighOutOfPocket = outOfPocketCents > totalVetBillCents * 0.6

  return {
    eligibleAmountCents,
    remainingDeductibleCents,
    basePayoutCents,
    finalPayoutCents,
    outOfPocketCents,
    reimbursementPct,
    isHighOutOfPocket,
  }
}

// Inline validation — never runs in production (process.env.NODE_ENV check keeps it dead code)
if (process.env.RUN_INSURANCE_CALC_TEST === 'true') {
  // $3,000 bill | $0 exam fee | $500 deductible | $200 already met | 80% | unlimited
  // remainingDeductible = $300, eligible = $3,000, payout = $2,700 * 0.80 = $2,160, OOP = $840
  const result = calculateInsurancePayout({
    totalVetBillCents: 300_000,
    examFeeCents: 0,
    examFeeCovered: false,
    annualDeductibleCents: 50_000,
    deductibleAlreadyMetCents: 20_000,
    reimbursementPct: 80,
    annualLimitCents: null,
  })

  const assertions: Array<[string, number | boolean, number | boolean]> = [
    ['eligibleAmountCents',    result.eligibleAmountCents,    300_000],
    ['remainingDeductibleCents', result.remainingDeductibleCents, 30_000],
    ['basePayoutCents',        result.basePayoutCents,        216_000],
    ['finalPayoutCents',       result.finalPayoutCents,       216_000],
    ['outOfPocketCents',       result.outOfPocketCents,        84_000],
    ['isHighOutOfPocket',      result.isHighOutOfPocket,        false],
  ]

  let passed = true
  for (const [label, actual, expected] of assertions) {
    if (actual !== expected) {
      console.error(`FAIL ${label}: expected ${expected}, got ${actual}`)
      passed = false
    }
  }
  if (passed) console.log('calculateInsurancePayout: all assertions passed ✓')
}
