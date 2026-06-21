export type RiskLevel = 'stable' | 'caution' | 'critical'

export interface RiskAssessment {
  level: RiskLevel
  message: string
  badgeColor: string
}

// Thresholds per AAHA / ISFM feline diabetes consensus guidelines
export function evaluateGlucoseRisk(glucose: number): RiskAssessment {
  if (glucose < 60 || glucose > 300) {
    return {
      level: 'critical',
      message: 'Blood glucose is outside the safe range. Contact your veterinarian now.',
      badgeColor: 'bg-red-100 text-red-800 border-red-300',
    }
  }
  if ((glucose >= 60 && glucose <= 79) || (glucose >= 251 && glucose <= 300)) {
    return {
      level: 'caution',
      message:
        'Blood glucose is trending outside the target range. Re-check in a few hours and keep an eye on your cat.',
      badgeColor: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    }
  }
  return {
    level: 'stable',
    message: 'Blood glucose is within the target range.',
    badgeColor: 'bg-green-100 text-green-800 border-green-300',
  }
}

export const GLUCOSE_DISCLAIMER =
  "These ranges are general guidelines, not a substitute for your veterinarian's specific targets for your cat. Always follow your vet's individual treatment plan."

// Thresholds based on veterinary home-monitoring consensus for CHF: 15–30 bpm is normal at rest/sleep,
// sustained ≥30 warrants recheck within 4–6 hours, >35 or labored breathing requires immediate vet contact.
// Source: Tufts/Cummings Cardiology, VCA, VIN/Veterinary Partner, CVCA home-monitoring protocols.
// The ≥20% above individual baseline rule follows clinical handout guidance for twice-daily home monitoring.
export function evaluateCHFRisk(
  srrBpm: number,
  baselineSRR: number | null,
  lethargyLevel: number
): RiskAssessment {
  const highLethargy = lethargyLevel >= 4

  if (srrBpm > 35) {
    return {
      level: 'critical',
      message: highLethargy
        ? 'Sleeping respiratory rate is significantly elevated and your pet seems very lethargic. Contact your veterinarian or an emergency hospital now.'
        : 'Sleeping respiratory rate is significantly elevated. Contact your veterinarian or an emergency hospital now.',
      badgeColor: 'bg-red-100 text-red-800 border-red-300',
    }
  }

  const aboveAbsoluteThreshold = srrBpm >= 30
  const aboveRelativeThreshold = baselineSRR !== null && srrBpm >= baselineSRR * 1.2

  if (aboveAbsoluteThreshold || aboveRelativeThreshold) {
    return {
      level: 'caution',
      message: highLethargy
        ? 'Breathing rate is elevated and your pet seems lethargic. Recheck in 4–6 hours — if still elevated or worsening, contact your vet.'
        : 'Breathing rate is elevated. Recheck in 4–6 hours. If it stays elevated, contact your vet.',
      badgeColor: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    }
  }

  return {
    level: 'stable',
    message: 'Sleeping respiratory rate is within the normal range.',
    badgeColor: 'bg-green-100 text-green-800 border-green-300',
  }
}

export const CHF_DISCLAIMER =
  "These ranges follow veterinary home-monitoring guidelines for heart disease. Always follow your veterinarian's specific targets and treatment plan for your pet."
