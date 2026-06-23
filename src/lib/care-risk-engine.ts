import type { CKDLogEntry, CushingsLogEntry, OALogEntry, EpilepsyLogEntry, HyperthyroidismLogEntry, IBDLogEntry, CDSLogEntry, DMLogEntry } from './care-storage'

export type RiskLevel = 'stable' | 'caution' | 'critical'

export interface RiskAssessment {
  level: RiskLevel
  message: string
  badgeColor: string
  displayLabel?: string
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

// Sources: Merck Veterinary Manual — Renal Dysfunction in Dogs and Cats;
// Purina Institute — Maintaining Hydration in Cats with CKD (Quimby, DACVIM);
// VIN/WSAVA — How I Treat Uremic Crises (uremic vomiting threshold)
export function evaluateCKDRisk(entry: CKDLogEntry): RiskAssessment {
  if (entry.skinTurgor === 'tented' || entry.vomitingCount >= 3) {
    return {
      level: 'critical',
      message:
        'URGENT: Signs of uremic crisis. Tented skin indicates significant dehydration; vomiting ≥3 times in 24 hours suggests uremic toxin buildup. Contact your vet or emergency clinic today.',
      badgeColor: 'bg-red-100 text-red-800 border-red-300',
    }
  }
  if (
    entry.skinTurgor === 'sticky' ||
    entry.vomitingCount === 2 ||
    (entry.appetite === 'refused' && entry.lethargyScore >= 3)
  ) {
    return {
      level: 'caution',
      message:
        'Watch closely: Mild dehydration or repeated vomiting can escalate quickly in CKD. Ensure your pet is drinking and contact your vet if this continues today.',
      badgeColor: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    }
  }
  return {
    level: 'stable',
    message: 'No urgent signs today. Keep monitoring hydration and appetite.',
    badgeColor: 'bg-green-100 text-green-800 border-green-300',
  }
}

export const CKD_DISCLAIMER =
  "CKD monitoring guidelines are based on Merck Veterinary Manual and Purina Institute guidance. Always follow your veterinarian's individual treatment plan for your pet's specific IRIS stage."

// Sources: Dechra Vetoryl Treating/Monitoring Cushing's official guidance;
// AAHA 2023 Selected Endocrinopathies of Dogs and Cats Guidelines;
// dvm360 — How to Manage Cushing's Syndrome (trilostane adverse effects)
export function evaluateCushingsRisk(entry: CushingsLogEntry): RiskAssessment {
  if (entry.lethargyScore >= 4 && (entry.appetite === 'refused' || entry.vomitingOrDiarrhea)) {
    return {
      level: 'critical',
      message:
        "URGENT: Possible over-suppression / Addisonian crisis. Severe lethargy combined with appetite loss or GI signs can indicate cortisol is too low — a serious drug side effect. STOP Vetoryl and contact your vet immediately.",
      badgeColor: 'bg-red-100 text-red-800 border-red-300',
    }
  }
  if (
    entry.lethargyScore >= 3 ||
    (entry.waterIntake === 'excessive' && entry.indoorAccidents) ||
    entry.vomitingOrDiarrhea
  ) {
    return {
      level: 'caution',
      message:
        "Watch closely: These signs may indicate Cushing's is under-controlled or that trilostane is over-suppressing cortisol. Contact your vet — an ACTH stimulation test may be needed.",
      badgeColor: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    }
  }
  return {
    level: 'stable',
    message: 'No urgent signs today. Continue monitoring water intake and energy levels.',
    badgeColor: 'bg-green-100 text-green-800 border-green-300',
  }
}

export const CUSHINGS_DISCLAIMER =
  "Monitoring guidelines are based on Dechra Vetoryl prescribing guidance and AAHA 2023 endocrinopathy guidelines. Always follow your veterinarian's individual monitoring plan."

// Sources: 2022 AAHA Pain Management Guidelines for Dogs and Cats;
// Zoetis Librela/Solensia clinical summary (NGF-targeting monoclonal antibody efficacy);
// Frontiers Vet Sci — CaOA-QoL-TS validation (Librela field study meaningful change thresholds)
export function evaluateOARisk(entry: OALogEntry): RiskAssessment {
  if (
    entry.easOfRising === 'refused' ||
    (entry.overallMobilityScore >= 5 && entry.painMedGiven)
  ) {
    return {
      level: 'critical',
      message:
        'URGENT: Severe pain breakthrough. Unable to rise from rest even with pain medication indicates the current analgesic protocol is not controlling pain. Contact your vet today to discuss adjusting the treatment plan.',
      badgeColor: 'bg-red-100 text-red-800 border-red-300',
    }
  }
  if (
    (entry.easOfRising === 'hesitant' && entry.overallMobilityScore >= 4) ||
    (entry.stairsNegotiated === 'refused' && entry.easOfRising !== 'smooth')
  ) {
    return {
      level: 'caution',
      message:
        "Watch closely: Significant mobility limitations today. Log consistently this week — if scores don't improve approaching the next injection window, discuss protocol adjustments with your vet.",
      badgeColor: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    }
  }
  return {
    level: 'stable',
    message: 'Mobility looks manageable today. Keep logging to track patterns around injection cycles.',
    badgeColor: 'bg-green-100 text-green-800 border-green-300',
  }
}

export const OA_DISCLAIMER =
  "Pain assessment guidelines are based on the 2022 AAHA Pain Management Guidelines for Dogs and Cats. Always follow your veterinarian's treatment plan."

// Sources: ACVIM Consensus Statement on SE and Cluster Seizures (Charalambous et al., 2024, JVIM);
// IVETF 2015 — epilepsy definition (cluster seizures = ≥2 seizures in 24h);
// Cornell CVM — Idiopathic Epilepsy in Dogs (emergency threshold guidance);
// MedVet/ACVIM Neurology (Dr. Jessica Kmiecik) — "5 minutes or back-to-back = emergency";
// Today's Veterinary Practice — Status Epilepticus in Canine Patients
export function evaluateEpilepsyRisk(logs: EpilepsyLogEntry[]): RiskAssessment {
  const now = Date.now()
  const ms24h = 24 * 60 * 60 * 1000
  const ms48h = 48 * 60 * 60 * 1000

  const last24h = logs.filter((l) => now - new Date(l.timestamp).getTime() <= ms24h)

  // CRITICAL: any seizure ≥5 min OR cluster (≥2) in rolling 24h window
  if (last24h.some((l) => l.durationMinutes >= 5) || last24h.length >= 2) {
    return {
      level: 'critical',
      message:
        'EMERGENCY: Status epilepticus or cluster seizures detected. Seizures lasting 5+ minutes or 2+ seizures in 24 hours can cause permanent neurological damage and hyperthermia. Transport to the nearest emergency veterinary hospital NOW.',
      badgeColor: 'bg-red-100 text-red-800 border-red-300',
    }
  }

  // CAUTION: any seizure in last 48h
  if (logs.some((l) => now - new Date(l.timestamp).getTime() <= ms48h)) {
    return {
      level: 'caution',
      message:
        'Seizure recorded. Monitor closely for additional episodes. Contact your vet to report this event and discuss whether medication adjustment is needed.',
      badgeColor: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    }
  }

  return {
    level: 'stable',
    message: logs.length === 0 ? 'No seizures logged yet.' : 'No seizures logged in the last 7 days.',
    badgeColor: 'bg-green-100 text-green-800 border-green-300',
  }
}

export const EPILEPSY_DISCLAIMER =
  "Seizure thresholds are based on ACVIM 2024 consensus guidelines for status epilepticus and the IVETF cluster seizure definition. This tool does not replace emergency veterinary care — if in doubt, go to the nearest emergency clinic immediately."

// Sources: Cornell Feline Health Center — Hyperthyroidism in Cats (methimazole monitoring);
// Dechra Felimazole prescribing information (facial excoriation, hepatotoxicity, blood dyscrasias);
// Peterson, M.E. — Radioiodine for Feline Hyperthyroidism: JAVMA pre-treatment evaluation criteria
export function evaluateHyperthyroidismRisk(entry: HyperthyroidismLogEntry): RiskAssessment {
  if (entry.yellowSkinOrGums || entry.bleedingOrBruising) {
    return {
      level: 'critical',
      message:
        'URGENT: Possible methimazole toxicity. Yellow skin or gums (jaundice) and unexplained bleeding are serious drug side effects. STOP medication and contact your vet or emergency clinic NOW.',
      badgeColor: 'bg-red-100 text-red-800 border-red-300',
    }
  }
  if (entry.vomitingCount >= 2 || (entry.facialScratching && entry.lethargyScore >= 3)) {
    return {
      level: 'caution',
      message:
        'Watch closely: GI upset or facial scratching with lethargy can indicate methimazole side effects. Contact your vet — a dose adjustment or medication switch may be needed.',
      badgeColor: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    }
  }
  return {
    level: 'stable',
    message: 'No urgent signs today. Keep monitoring medication tolerance and weight.',
    badgeColor: 'bg-green-100 text-green-800 border-green-300',
  }
}

export const HYPERTHYROIDISM_DISCLAIMER =
  "Monitoring guidelines are based on Dechra Felimazole prescribing guidance and Cornell Feline Health Center recommendations. Always follow your veterinarian's individual treatment plan."

// Sources: Marks, S.L. — Canine and Feline IBD (VCNA 2005);
// WSAVA Global Nutrition Guidelines — Management of Chronic Enteropathy;
// Jergens, A.E. — IBD Activity Index and clinical scoring (VCNA 2012)
export function evaluateIBDRisk(entry: IBDLogEntry): RiskAssessment {
  if (entry.stoolConsistency === 'bloody' || (entry.vomitingCount >= 3 && entry.appetite === 'refused')) {
    return {
      level: 'critical',
      message:
        'URGENT: Bloody stool or severe vomiting with complete appetite loss can signal a serious IBD flare or obstruction. Contact your vet or emergency clinic today.',
      badgeColor: 'bg-red-100 text-red-800 border-red-300',
    }
  }
  if (
    entry.stoolConsistency === 'watery' ||
    entry.vomitingCount >= 2 ||
    (entry.appetite === 'refused' && entry.lethargyScore >= 3)
  ) {
    return {
      level: 'caution',
      message:
        'Watch closely: Watery stool, repeated vomiting, or appetite loss with lethargy can indicate an IBD flare. Keep your pet hydrated and contact your vet if this continues.',
      badgeColor: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    }
  }
  return {
    level: 'stable',
    message: 'GI signs are manageable today. Keep logging to track flare patterns.',
    badgeColor: 'bg-green-100 text-green-800 border-green-300',
  }
}

export const IBD_DISCLAIMER =
  "IBD monitoring guidelines are based on WSAVA chronic enteropathy guidance and VCNA clinical scoring recommendations. Always follow your veterinarian's individual treatment plan."

// Sources: AAHA Cognitive Dysfunction Syndrome and Dementia Consensus Guidelines 2023;
// Madari, A. et al. — DISHAA canine/feline CDS assessment validation, JVIM 2015;
// Neilson, J.C. et al. — Prevalence of feline CDS by owner-reported signs, JAAHA 2001
export function computeDISHAAScore(entry: CDSLogEntry): number {
  return (
    (entry.disorientation === 'none' ? 0 : entry.disorientation === 'sometimes' ? 1 : 2) +
    (entry.socialInteraction === 'normal' ? 0 : entry.socialInteraction === 'reduced' ? 1 : 2) +
    (entry.sleepChanges === 'none' ? 0 : entry.sleepChanges === 'mild' ? 1 : 2) +
    (entry.houseTraining === 'normal' ? 0 : entry.houseTraining === 'occasional_accidents' ? 1 : 2) +
    (entry.activityChanges === 'normal' ? 0 : entry.activityChanges === 'less_active' ? 1 : 2) +
    (entry.anxiety === 'none' ? 0 : entry.anxiety === 'mild' ? 1 : 2)
  )
}

export function evaluateCDSRisk(entry: CDSLogEntry): RiskAssessment {
  const score = computeDISHAAScore(entry)
  if (score >= 8) {
    return {
      level: 'critical',
      displayLabel: 'Significant',
      message:
        'DISHAA score indicates significant cognitive dysfunction. Multiple domains are severely affected. Discuss advanced management options — environmental enrichment, dietary antioxidants, and prescription medications (selegiline) — with your veterinarian.',
      badgeColor: 'bg-red-100 text-red-800 border-red-300',
    }
  }
  if (score >= 4) {
    return {
      level: 'caution',
      displayLabel: 'Moderate',
      message:
        'DISHAA score indicates moderate cognitive changes. Consistent weekly logging will help your vet assess whether the condition is progressing and whether treatment adjustments are needed.',
      badgeColor: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    }
  }
  return {
    level: 'stable',
    displayLabel: 'Mild',
    message:
      'DISHAA score indicates mild or no signs this week. Keep logging weekly — early detection of worsening helps guide treatment decisions.',
    badgeColor: 'bg-green-100 text-green-800 border-green-300',
  }
}

export const CDS_DISCLAIMER =
  "DISHAA scoring is based on the validated CDS assessment from Madari et al. (JVIM 2015) and AAHA 2023 Cognitive Dysfunction Consensus Guidelines. Always follow your veterinarian's guidance."

// Sources: Coates, J.R. & Wininger, F.A. — Canine Degenerative Myelopathy (VCNA 2010);
// ACVIM Neurology — DM clinical staging and management recommendations;
// Zeng, R. et al. — SOD1 mutation characterization and DM progression, PNAS 2014
export function evaluateDMRisk(entry: DMLogEntry): RiskAssessment {
  if (entry.hindLimbWalking === 'cannot_walk' || entry.continenceStatus === 'incontinent') {
    return {
      level: 'critical',
      displayLabel: 'Advanced',
      message:
        'Your dog has reached an advanced stage of DM. Non-ambulatory paraparesis and incontinence are expected progression milestones. A wheelchair cart, consistent bladder management, and regular repositioning can maintain comfort. Discuss palliative goals with your veterinarian.',
      badgeColor: 'bg-red-100 text-red-800 border-red-300',
    }
  }
  if (
    entry.hindLimbWalking === 'knuckling' ||
    entry.canRiseUnassisted === 'no' ||
    entry.continenceStatus === 'occasional_accident'
  ) {
    return {
      level: 'caution',
      displayLabel: 'Progressing',
      message:
        'DM is progressing to a moderate stage. Knuckling and rising difficulty indicate continued myelin loss. Consistent physiotherapy and underwater treadmill sessions can slow functional decline — discuss a rehab referral with your vet.',
      badgeColor: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    }
  }
  return {
    level: 'stable',
    displayLabel: 'Early Stage',
    message:
      'Your dog is in early-stage DM. Regular physiotherapy and exercise are the most effective way to slow progression. Keep logging weekly to catch changes early.',
    badgeColor: 'bg-green-100 text-green-800 border-green-300',
  }
}

export const DM_DISCLAIMER =
  "DM staging criteria are based on Coates & Wininger (VCNA 2010) and ACVIM neurology guidelines. DM is a progressive, non-painful condition — there is no cure, but quality of life can be sustained with proper care. Always follow your veterinarian's guidance."
