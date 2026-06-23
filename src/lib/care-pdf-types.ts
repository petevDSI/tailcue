export interface PdfReportData {
  petName: string
  species: 'cat' | 'dog'
  conditionLabel: string
  conditionKey: string
  ownerName?: string
  reportGeneratedAt: string
  dateRangeStart: string
  dateRangeEnd: string
  totalLogsInRange: number
  subjectiveNarrative: string
  medicationsSummary?: string
  logRows: PdfLogRow[]
  riskSummary: {
    stableDays: number
    cautionDays: number
    criticalDays: number
    totalDays: number
  }
  disclaimer: string
}

export interface PdfLogRow {
  date: string
  primaryMetric: string
  primaryLabel: string
  riskLevel: string
  secondaryNotes: string
}
