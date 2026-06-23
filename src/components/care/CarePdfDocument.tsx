'use client'

import React from 'react'
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import type { PdfReportData, PdfLogRow } from '@/lib/care-pdf-types'

const C = {
  charcoal: '#1C1917',
  amber: '#F59E0B',
  amberLight: '#FEF3C7',
  body: '#292524',
  muted: '#78716C',
  stable: '#16A34A',
  caution: '#D97706',
  critical: '#DC2626',
  rowAlt: '#FAFAF9',
  border: '#E7E5E4',
  white: '#FFFFFF',
}

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    backgroundColor: C.white,
    paddingTop: 0,
    paddingBottom: 50,
    paddingHorizontal: 0,
    fontSize: 9,
    color: C.body,
  },
  // Header bar
  headerBar: {
    backgroundColor: C.charcoal,
    paddingHorizontal: 40,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 0,
  },
  headerLeft: {
    flexDirection: 'column',
  },
  headerSubtitle: {
    fontSize: 7,
    color: C.amber,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 1,
    marginBottom: 3,
  },
  headerTitle: {
    fontSize: 16,
    color: C.white,
    fontFamily: 'Helvetica-Bold',
  },
  headerBrand: {
    fontSize: 8,
    color: '#A8A29E',
    fontFamily: 'Helvetica',
  },
  // Content area
  content: {
    paddingHorizontal: 40,
    paddingTop: 20,
  },
  // Pet identity row
  identityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  petName: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    color: C.charcoal,
    marginBottom: 3,
  },
  petMeta: {
    fontSize: 8,
    color: C.muted,
  },
  conditionBadge: {
    backgroundColor: C.amberLight,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 4,
    alignSelf: 'flex-end',
  },
  conditionBadgeText: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#92400E',
  },
  dateRangeText: {
    fontSize: 8,
    color: C.muted,
    textAlign: 'right',
  },
  // Divider
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    borderBottomStyle: 'solid',
    marginBottom: 16,
  },
  // Section header
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    marginTop: 4,
  },
  sectionBadge: {
    backgroundColor: C.amber,
    width: 18,
    height: 18,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  sectionBadgeText: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: C.white,
  },
  sectionLabel: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: C.charcoal,
    letterSpacing: 0.3,
  },
  sectionBody: {
    marginBottom: 16,
    paddingLeft: 26,
  },
  narrative: {
    fontSize: 9,
    color: C.body,
    lineHeight: 1.5,
    marginBottom: 6,
  },
  medLabel: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: C.muted,
    marginBottom: 2,
  },
  medValue: {
    fontSize: 9,
    color: C.body,
  },
  // Risk summary boxes
  riskRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  riskBox: {
    flex: 1,
    borderWidth: 1,
    borderStyle: 'solid',
    borderRadius: 4,
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginRight: 6,
    alignItems: 'center',
  },
  riskBoxLast: {
    marginRight: 0,
  },
  riskBoxCount: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 2,
  },
  riskBoxLabel: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 0.5,
  },
  // Data table
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: C.charcoal,
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginBottom: 0,
  },
  tableHeaderCell: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: C.white,
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    borderBottomStyle: 'solid',
  },
  tableRowAlt: {
    backgroundColor: C.rowAlt,
  },
  tableCell: {
    fontSize: 8,
    color: C.body,
  },
  // Column widths
  colDate: { width: 52 },
  colMetric: { width: 70 },
  colStatus: { width: 62 },
  colNotes: { flex: 1 },
  // Assessment / Plan boxes
  writingBox: {
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: C.border,
    borderRadius: 4,
    height: 90,
    marginBottom: 4,
  },
  writingBoxNote: {
    fontSize: 7.5,
    color: C.muted,
    fontFamily: 'Helvetica-Oblique',
    marginBottom: 6,
  },
  // Footer
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 40,
    right: 40,
    borderTopWidth: 1,
    borderTopColor: C.border,
    borderTopStyle: 'solid',
    paddingTop: 8,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  footerText: {
    fontSize: 7,
    color: C.muted,
  },
  disclaimer: {
    fontSize: 6.5,
    color: '#A8A29E',
    lineHeight: 1.4,
  },
  overflowNote: {
    fontSize: 7.5,
    color: C.muted,
    fontFamily: 'Helvetica-Oblique',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
})

function riskColor(level: string): string {
  const l = level.toLowerCase()
  if (l === 'critical' || l === 'significant' || l === 'advanced') return C.critical
  if (l === 'caution' || l === 'moderate' || l === 'progressing') return C.caution
  return C.stable
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

interface SectionHeaderProps {
  letter: string
  label: string
}

function SectionHeader({ letter, label }: SectionHeaderProps) {
  return (
    <View style={styles.sectionRow}>
      <View style={styles.sectionBadge}>
        <Text style={styles.sectionBadgeText}>{letter}</Text>
      </View>
      <Text style={styles.sectionLabel}>{label}</Text>
    </View>
  )
}

const MAX_TABLE_ROWS = 30

interface Props {
  data: PdfReportData
}

export function CarePdfDocument({ data }: Props) {
  const displayedRows = data.logRows.slice(0, MAX_TABLE_ROWS)
  const overflow = data.logRows.length - displayedRows.length

  return (
    <Document title={`${data.petName} — Tailcue Care Report`}>
      <Page size="LETTER" style={styles.page}>

        {/* ── HEADER BAR ── */}
        <View style={styles.headerBar}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerSubtitle}>HOME MONITORING SUMMARY</Text>
            <Text style={styles.headerTitle}>Pre-Appointment Report</Text>
          </View>
          <Text style={styles.headerBrand}>tailcue.com</Text>
        </View>

        <View style={styles.content}>

          {/* ── PET IDENTITY ROW ── */}
          <View style={styles.identityRow}>
            <View>
              <Text style={styles.petName}>{data.petName}</Text>
              <Text style={styles.petMeta}>
                {data.species.charAt(0).toUpperCase() + data.species.slice(1)}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <View style={styles.conditionBadge}>
                <Text style={styles.conditionBadgeText}>{data.conditionLabel}</Text>
              </View>
              <Text style={styles.dateRangeText}>
                {fmtDate(data.dateRangeStart)} – {fmtDate(data.dateRangeEnd)}
              </Text>
              <Text style={[styles.dateRangeText, { marginTop: 2 }]}>
                {data.totalLogsInRange} {data.totalLogsInRange === 1 ? 'entry' : 'entries'} in range
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          {/* ── S — SUBJECTIVE ── */}
          <SectionHeader letter="S" label="SUBJECTIVE — Owner-Reported History" />
          <View style={styles.sectionBody}>
            <Text style={styles.narrative}>{data.subjectiveNarrative}</Text>
            {data.medicationsSummary && (
              <>
                <Text style={styles.medLabel}>CURRENT MEDICATIONS</Text>
                <Text style={styles.medValue}>{data.medicationsSummary}</Text>
              </>
            )}
          </View>

          {/* ── O — OBJECTIVE ── */}
          <SectionHeader letter="O" label="OBJECTIVE — Home Monitoring Data" />
          <View style={[styles.sectionBody, { marginBottom: 0 }]}>
            {/* Risk summary boxes */}
            <View style={styles.riskRow}>
              <View style={[styles.riskBox, { borderColor: '#86EFAC' }]}>
                <Text style={[styles.riskBoxCount, { color: C.stable }]}>{data.riskSummary.stableDays}</Text>
                <Text style={[styles.riskBoxLabel, { color: C.stable }]}>STABLE</Text>
              </View>
              <View style={[styles.riskBox, { borderColor: '#FCD34D' }]}>
                <Text style={[styles.riskBoxCount, { color: C.caution }]}>{data.riskSummary.cautionDays}</Text>
                <Text style={[styles.riskBoxLabel, { color: C.caution }]}>CAUTION</Text>
              </View>
              <View style={[styles.riskBox, styles.riskBoxLast, { borderColor: '#FCA5A5' }]}>
                <Text style={[styles.riskBoxCount, { color: C.critical }]}>{data.riskSummary.criticalDays}</Text>
                <Text style={[styles.riskBoxLabel, { color: C.critical }]}>CRITICAL</Text>
              </View>
            </View>

            {/* Table */}
            {displayedRows.length === 0 ? (
              <Text style={styles.narrative}>No entries logged in the selected date range.</Text>
            ) : (
              <>
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableHeaderCell, styles.colDate]}>DATE</Text>
                  <Text style={[styles.tableHeaderCell, styles.colMetric]}>
                    {data.logRows[0]?.primaryLabel?.toUpperCase() ?? 'READING'}
                  </Text>
                  <Text style={[styles.tableHeaderCell, styles.colStatus]}>STATUS</Text>
                  <Text style={[styles.tableHeaderCell, styles.colNotes]}>NOTES</Text>
                </View>
                {displayedRows.map((row: PdfLogRow, i: number) => (
                  <View key={i} style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]}>
                    <Text style={[styles.tableCell, styles.colDate]}>{row.date}</Text>
                    <Text style={[styles.tableCell, styles.colMetric]}>{row.primaryMetric}</Text>
                    <Text style={[styles.tableCell, styles.colStatus, { color: riskColor(row.riskLevel), fontFamily: 'Helvetica-Bold' }]}>
                      {row.riskLevel}
                    </Text>
                    <Text style={[styles.tableCell, styles.colNotes]}>
                      {row.secondaryNotes.length > 80 ? row.secondaryNotes.slice(0, 77) + '…' : row.secondaryNotes}
                    </Text>
                  </View>
                ))}
                {overflow > 0 && (
                  <Text style={styles.overflowNote}>
                    + {overflow} more {overflow === 1 ? 'entry' : 'entries'} not shown (export full range to see all)
                  </Text>
                )}
              </>
            )}
          </View>

          <View style={[styles.divider, { marginTop: 16 }]} />

          {/* ── A — ASSESSMENT ── */}
          <SectionHeader letter="A" label="ASSESSMENT — Veterinarian to Complete" />
          <View style={[styles.sectionBody, { marginBottom: 14 }]}>
            <Text style={styles.writingBoxNote}>
              To be completed by the attending veterinarian at time of visit.
            </Text>
            <View style={styles.writingBox} />
          </View>

          {/* ── P — PLAN ── */}
          <SectionHeader letter="P" label="PLAN — Veterinarian to Complete" />
          <View style={styles.sectionBody}>
            <Text style={styles.writingBoxNote}>
              Treatment adjustments, diagnostics, and follow-up instructions.
            </Text>
            <View style={styles.writingBox} />
          </View>

        </View>

        {/* ── FOOTER ── */}
        <View style={styles.footer} fixed>
          <View style={styles.footerRow}>
            <Text style={styles.footerText}>
              Generated by Tailcue Care · tailcue.com · {fmtDate(data.reportGeneratedAt)}
            </Text>
            <Text style={styles.footerText}>Page 1</Text>
          </View>
          <Text style={styles.disclaimer}>{data.disclaimer}</Text>
        </View>

      </Page>
    </Document>
  )
}
