export type ExtractedPolicyFacts = {
  waiting_periods: {
    accident_days: number | null
    illness_days: number | null
    orthopedic_days: number | null
    cruciate_ligament_days: number | null
    notes: string
  }
  pre_existing_conditions: {
    covered: boolean
    curable_after_symptom_free_days: number | null
    definition_summary: string // paraphrased, max 2 sentences
  }
  exclusions: string[] // short paraphrased phrases, max 15 items
  dental: {
    illness_covered: boolean | null
    injury_covered: boolean | null
    routine_cleaning_covered: boolean
  }
  reimbursement_options: string // e.g. "70%, 80%, or 90%"
  deductible_type: 'annual' | 'per_condition' | 'per_incident' | 'unknown'
  wellness_available: boolean
  wellness_addon_name: string | null
  policy_document_date: string | null // e.g. "09-23" or "2024" if found in doc
  extraction_confidence: 'high' | 'medium' | 'low'
  extraction_notes: string // anything ambiguous or uncertain
}

export const EXTRACTION_SCHEMA_DESCRIPTION = `
{
  "waiting_periods": {
    "accident_days": <integer or null — days before accident coverage begins>,
    "illness_days": <integer or null — days before illness coverage begins>,
    "orthopedic_days": <integer or null — days before orthopedic coverage begins>,
    "cruciate_ligament_days": <integer or null — days before cruciate/CCL/ACL coverage begins, may differ from orthopedic>,
    "notes": "<string — any unusual waiting period rules, e.g. waived with vet exam>"
  },
  "pre_existing_conditions": {
    "covered": <boolean — are ANY pre-existing conditions ever coverable>,
    "curable_after_symptom_free_days": <integer or null — days symptom-free before a curable condition may be covered>,
    "definition_summary": "<string — paraphrase the policy's definition of pre-existing condition in 1-2 sentences>"
  },
  "exclusions": [
    "<string — short paraphrased phrase>",
    ... up to 15 items
  ],
  "dental": {
    "illness_covered": <boolean or null — is dental disease/illness covered>,
    "injury_covered": <boolean or null — are dental injuries/accidents covered>,
    "routine_cleaning_covered": <boolean — is routine dental cleaning covered>
  },
  "reimbursement_options": "<string — e.g. '70%, 80%, or 90%' or 'fixed at 90%'>",
  "deductible_type": "<'annual' | 'per_condition' | 'per_incident' | 'unknown'>",
  "wellness_available": <boolean — is a wellness/preventive care add-on offered>,
  "wellness_addon_name": "<string or null — name of the wellness plan if offered>",
  "policy_document_date": "<string or null — date found in document header/footer, e.g. '2024' or '06-2023'>",
  "extraction_confidence": "<'high' | 'medium' | 'low'>",
  "extraction_notes": "<string — describe anything uncertain, missing, or ambiguous>"
}
`.trim()
