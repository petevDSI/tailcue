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
