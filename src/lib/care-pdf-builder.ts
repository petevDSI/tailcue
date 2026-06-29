import {
  type PetProfile, type CareLogEntry,
  type DiabetesLogEntry, type CHFLogEntry, type CKDLogEntry,
  type CushingsLogEntry, type OALogEntry, type EpilepsyLogEntry,
  type HyperthyroidismLogEntry, type IBDLogEntry, type CDSLogEntry, type DMLogEntry,
  type MedicationGivenLogEntry,
} from './care-storage'
import {
  evaluateGlucoseRisk, evaluateCHFRisk, evaluateCKDRisk, evaluateCushingsRisk,
  evaluateOARisk, evaluateEpilepsyRisk, evaluateHyperthyroidismRisk,
  evaluateIBDRisk, evaluateCDSRisk, computeDISHAAScore, evaluateDMRisk,
} from './care-risk-engine'
import type { PdfReportData, PdfLogRow } from './care-pdf-types'

const STORAGE_KEY = 'tailcue_care_data_v2'

const CONDITION_LABELS: Record<PetProfile['condition'], string> = {
  feline_diabetes: 'Feline Diabetes',
  chf: 'Heart Disease (CHF)',
  chronic_kidney_disease: 'Kidney Disease (CKD)',
  cushings_disease: "Cushing's Disease",
  osteoarthritis: 'Arthritis / Joint Disease (OA)',
  epilepsy: 'Epilepsy / Seizure Disorder',
  feline_hyperthyroidism: 'Hyperthyroidism',
  ibd: 'Inflammatory Bowel Disease (IBD)',
  cognitive_dysfunction: 'Cognitive Dysfunction (CDS)',
  degenerative_myelopathy: 'Degenerative Myelopathy (DM)',
}

const CONDITION_DISCLAIMERS: Record<PetProfile['condition'], string> = {
  feline_diabetes: 'Glucose thresholds follow AAHA/ISFM feline diabetes monitoring guidelines.',
  chf: 'Respiratory rate thresholds follow Tufts/CVCA home-monitoring protocols for CHF.',
  chronic_kidney_disease: 'CKD monitoring follows WSAVA/Merck Veterinary Manual guidelines.',
  cushings_disease: "Monitoring follows Dechra Vetoryl prescribing guidance and AAHA 2023 guidelines.",
  osteoarthritis: 'Pain assessment follows the 2022 AAHA Pain Management Guidelines.',
  epilepsy: 'Seizure thresholds follow ACVIM 2024 consensus guidelines for status epilepticus.',
  feline_hyperthyroidism: 'Monitoring follows Dechra Felimazole prescribing guidance.',
  ibd: 'IBD monitoring follows WSAVA chronic enteropathy guidance.',
  cognitive_dysfunction: 'DISHAA scoring follows Madari et al. (JVIM 2015) and AAHA 2023 CDS Guidelines.',
  degenerative_myelopathy: 'DM staging follows Coates & Wininger (VCNA 2010) and ACVIM neurology guidelines.',
}

function fmtLogDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function fmtIsoDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function getRiskForEntry(profile: PetProfile, entry: Exclude<CareLogEntry, MedicationGivenLogEntry>, allLogs: CareLogEntry[]) {
  switch (entry.condition) {
    case 'feline_diabetes': return evaluateGlucoseRisk((entry as DiabetesLogEntry).bloodGlucose)
    case 'chf': {
      const e = entry as CHFLogEntry
      return evaluateCHFRisk(e.srrBpm, profile.chfBaselineSRR ?? null, e.lethargyLevel)
    }
    case 'chronic_kidney_disease': return evaluateCKDRisk(entry as CKDLogEntry)
    case 'cushings_disease': return evaluateCushingsRisk(entry as CushingsLogEntry)
    case 'osteoarthritis': return evaluateOARisk(entry as OALogEntry)
    case 'epilepsy': {
      const eLogs = allLogs.filter((l): l is EpilepsyLogEntry => l.condition === 'epilepsy')
      return evaluateEpilepsyRisk(eLogs)
    }
    case 'feline_hyperthyroidism': return evaluateHyperthyroidismRisk(entry as HyperthyroidismLogEntry)
    case 'ibd': return evaluateIBDRisk(entry as IBDLogEntry)
    case 'cognitive_dysfunction': return evaluateCDSRisk(entry as CDSLogEntry)
    case 'degenerative_myelopathy': return evaluateDMRisk(entry as DMLogEntry)
  }
}

function buildLogRow(profile: PetProfile, entry: Exclude<CareLogEntry, MedicationGivenLogEntry>, allLogs: CareLogEntry[]): PdfLogRow {
  const risk = getRiskForEntry(profile, entry, allLogs)
  const riskLevel = risk.displayLabel ?? (risk.level.charAt(0).toUpperCase() + risk.level.slice(1))
  let primaryMetric = '—'
  let primaryLabel = 'Reading'
  let secondaryNotes = ''

  switch (entry.condition) {
    case 'feline_diabetes': {
      const e = entry as DiabetesLogEntry
      primaryMetric = `${e.bloodGlucose} mg/dL`
      primaryLabel = 'Glucose'
      const parts: string[] = [`Appetite: ${e.appetite}`]
      if (e.insulinUnits > 0) parts.push(`Dose: ${e.insulinUnits}u ${e.insulinType || 'insulin'}`)
      secondaryNotes = parts.join(', ')
      break
    }
    case 'chf': {
      const e = entry as CHFLogEntry
      primaryMetric = `${e.srrBpm} bpm`
      primaryLabel = 'Sleep RR'
      secondaryNotes = `Lethargy: ${e.lethargyLevel}/5`
      break
    }
    case 'chronic_kidney_disease': {
      const e = entry as CKDLogEntry
      primaryMetric = `${e.vomitingCount} episodes`
      primaryLabel = 'Vomiting'
      const parts = [`Skin: ${e.skinTurgor}`, `Appetite: ${e.appetite}`, `Lethargy: ${e.lethargyScore}/5`]
      if (e.subqFluidMl !== null) parts.push(`SubQ: ${e.subqFluidMl} mL`)
      secondaryNotes = parts.slice(0, 3).join(', ')
      break
    }
    case 'cushings_disease': {
      const e = entry as CushingsLogEntry
      primaryMetric = `${e.lethargyScore}/5`
      primaryLabel = 'Lethargy'
      const parts = [`Water: ${e.waterIntake}`, `Med: ${e.medicationGiven ? 'given' : 'missed'}`]
      if (e.indoorAccidents) parts.push('Accidents: yes')
      if (e.vomitingOrDiarrhea) parts.push('GI: yes')
      secondaryNotes = parts.slice(0, 3).join(', ')
      break
    }
    case 'osteoarthritis': {
      const e = entry as OALogEntry
      primaryMetric = `${e.overallMobilityScore}/5`
      primaryLabel = 'Mobility'
      secondaryNotes = `Rising: ${e.easOfRising}, Pain med: ${e.painMedGiven ? 'yes' : 'no'}, Stairs: ${e.stairsNegotiated}`
      break
    }
    case 'epilepsy': {
      const e = entry as EpilepsyLogEntry
      primaryMetric = `${e.durationMinutes} min`
      primaryLabel = 'Seizure'
      secondaryNotes = `Severity: ${e.severity}, Recovery: ${e.postIctalMinutes} min`
      break
    }
    case 'feline_hyperthyroidism': {
      const e = entry as HyperthyroidismLogEntry
      primaryMetric = `${e.lethargyScore}/5`
      primaryLabel = 'Lethargy'
      const parts = [`Appetite: ${e.appetite}`, `Vomit: ${e.vomitingCount}`, `Med: ${e.medicationGiven ? 'given' : 'missed'}`]
      secondaryNotes = parts.join(', ')
      break
    }
    case 'ibd': {
      const e = entry as IBDLogEntry
      primaryMetric = `${e.vomitingCount}v / ${e.stoolConsistency}`
      primaryLabel = 'GI Score'
      secondaryNotes = `Appetite: ${e.appetite}, Diet: ${e.dietCompliance ? 'followed' : 'lapsed'}, Lethargy: ${e.lethargyScore}/5`
      break
    }
    case 'cognitive_dysfunction': {
      const e = entry as CDSLogEntry
      const score = computeDISHAAScore(e)
      primaryMetric = `${score}/12`
      primaryLabel = 'DISHAA Score'
      secondaryNotes = `Disorientation: ${e.disorientation}, Sleep: ${e.sleepChanges}, Anxiety: ${e.anxiety}`
      break
    }
    case 'degenerative_myelopathy': {
      const e = entry as DMLogEntry
      primaryMetric = e.hindLimbWalking.replace(/_/g, ' ')
      primaryLabel = 'Hind Limb'
      secondaryNotes = `Rising: ${e.canRiseUnassisted.replace(/_/g, ' ')}, Continence: ${e.continenceStatus.replace(/_/g, ' ')}, Rehab: ${e.rehabDoneToday ? 'yes' : 'no'}`
      break
    }
  }

  return {
    date: fmtLogDate(entry.timestamp),
    primaryMetric,
    primaryLabel,
    riskLevel,
    secondaryNotes,
  }
}

function buildSubjectiveNarrative(
  profile: PetProfile,
  filtered: CareLogEntry[],
  startIso: string,
  endIso: string,
  metrics: number[],
): string {
  const petName = profile.name
  const condLabel = CONDITION_LABELS[profile.condition]
  const n = filtered.length
  const startFmt = fmtIsoDate(startIso)
  const endFmt = fmtIsoDate(endIso)

  if (n === 0) {
    return `${petName} is being monitored for ${condLabel}. No entries were logged in the selected date range.`
  }

  const min = Math.min(...metrics)
  const max = Math.max(...metrics)
  const avg = metrics.reduce((s, v) => s + v, 0) / metrics.length

  const sentences: string[] = []
  sentences.push(`${petName} was monitored for ${condLabel} over ${n} log ${n === 1 ? 'entry' : 'entries'} from ${startFmt} to ${endFmt}.`)

  const cond = profile.condition
  if (cond === 'feline_diabetes') {
    sentences.push(`Blood glucose ranged from ${min} to ${max} mg/dL with a mean of ${avg.toFixed(1)} mg/dL.`)
  } else if (cond === 'chf') {
    sentences.push(`Sleeping respiratory rate ranged from ${min} to ${max} bpm with a mean of ${avg.toFixed(1)} bpm.`)
  } else if (cond === 'chronic_kidney_disease') {
    sentences.push(`Vomiting episodes per day ranged from ${min} to ${max} with a mean of ${avg.toFixed(1)}.`)
  } else if (cond === 'cushings_disease') {
    sentences.push(`Lethargy score ranged from ${min} to ${max}/5 with a mean of ${avg.toFixed(1)}.`)
  } else if (cond === 'osteoarthritis') {
    sentences.push(`Overall mobility score ranged from ${min} to ${max}/5 with a mean of ${avg.toFixed(1)}.`)
  } else if (cond === 'epilepsy') {
    sentences.push(`${n} seizure ${n === 1 ? 'event was' : 'events were'} logged, with durations ranging from ${min} to ${max} minutes.`)
  } else if (cond === 'feline_hyperthyroidism') {
    sentences.push(`Lethargy score ranged from ${min} to ${max}/5 with a mean of ${avg.toFixed(1)}.`)
  } else if (cond === 'ibd') {
    sentences.push(`Vomiting episodes per day ranged from ${min} to ${max} with a mean of ${avg.toFixed(1)}.`)
  } else if (cond === 'cognitive_dysfunction') {
    sentences.push(`DISHAA score ranged from ${min} to ${max}/12 with a mean of ${avg.toFixed(1)}.`)
  } else if (cond === 'degenerative_myelopathy') {
    sentences.push(`${n} weekly mobility ${n === 1 ? 'check-in was' : 'check-ins were'} logged over this period.`)
  }

  return sentences.join(' ')
}

function buildMedicationsSummary(profile: PetProfile): string | undefined {
  if (profile.condition === 'feline_diabetes') {
    const parts: string[] = []
    if (profile.insulinConcentration) parts.push(`Insulin: ${profile.insulinConcentration}`)
    if (profile.vialSizeML) parts.push(`Vial: ${profile.vialSizeML} mL`)
    return parts.length > 0 ? parts.join(', ') : undefined
  }
  return undefined
}

function getPrimaryMetricValue(profile: PetProfile, entry: CareLogEntry): number | null {
  switch (entry.condition) {
    case 'feline_diabetes': return (entry as DiabetesLogEntry).bloodGlucose
    case 'chf': return (entry as CHFLogEntry).srrBpm
    case 'chronic_kidney_disease': return (entry as CKDLogEntry).vomitingCount
    case 'cushings_disease': return (entry as CushingsLogEntry).lethargyScore
    case 'osteoarthritis': return (entry as OALogEntry).overallMobilityScore
    case 'epilepsy': return (entry as EpilepsyLogEntry).durationMinutes
    case 'feline_hyperthyroidism': return (entry as HyperthyroidismLogEntry).lethargyScore
    case 'ibd': return (entry as IBDLogEntry).vomitingCount
    case 'cognitive_dysfunction': return computeDISHAAScore(entry as CDSLogEntry)
    case 'degenerative_myelopathy': {
      const map: Record<DMLogEntry['hindLimbWalking'], number> = {
        normal_gait: 1, wobbling_or_weak: 2, knuckling: 3, cannot_walk: 4,
      }
      return map[(entry as DMLogEntry).hindLimbWalking]
    }
    default: return null
  }
}

export function buildPdfReportData(
  petId: string,
  rangedays: 14 | 30 | 60 | 90 | 'all',
): PdfReportData | null {
  if (typeof window === 'undefined') return null

  let store: { pets: Record<string, { profile: PetProfile; logs: CareLogEntry[] }> }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    store = JSON.parse(raw)
  } catch {
    return null
  }

  const record = store.pets?.[petId]
  if (!record) return null

  const { profile, logs: allLogs } = record
  const now = Date.now()
  const cutoff = rangedays === 'all' ? 0 : now - rangedays * 24 * 60 * 60 * 1000

  const filtered = allLogs
    .filter((l): l is Exclude<CareLogEntry, MedicationGivenLogEntry> => l.condition !== undefined)
    .filter((l) => new Date(l.timestamp).getTime() >= cutoff)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

  const rangeStart = filtered.length > 0
    ? filtered[0].timestamp
    : rangedays === 'all' ? profile.createdAt : new Date(cutoff).toISOString()
  const rangeEnd = new Date().toISOString()

  const logRows = filtered.map((e) => buildLogRow(profile, e, allLogs))

  const metrics = filtered
    .map((e) => getPrimaryMetricValue(profile, e))
    .filter((v): v is number => v !== null)

  const riskSummary = { stableDays: 0, cautionDays: 0, criticalDays: 0, totalDays: filtered.length }
  for (const entry of filtered) {
    const risk = getRiskForEntry(profile, entry, allLogs)
    if (risk.level === 'stable') riskSummary.stableDays++
    else if (risk.level === 'caution') riskSummary.cautionDays++
    else riskSummary.criticalDays++
  }

  return {
    petName: profile.name,
    species: profile.species,
    conditionLabel: CONDITION_LABELS[profile.condition],
    conditionKey: profile.condition,
    reportGeneratedAt: rangeEnd,
    dateRangeStart: rangeStart,
    dateRangeEnd: rangeEnd,
    totalLogsInRange: filtered.length,
    subjectiveNarrative: buildSubjectiveNarrative(profile, filtered, rangeStart, rangeEnd, metrics),
    medicationsSummary: buildMedicationsSummary(profile),
    logRows,
    riskSummary,
    disclaimer:
      'This report was generated from owner-logged home observations using Tailcue Care (tailcue.com). It is intended to supplement, not replace, the clinical examination and professional veterinary judgment. ' +
      CONDITION_DISCLAIMERS[profile.condition],
  }
}
