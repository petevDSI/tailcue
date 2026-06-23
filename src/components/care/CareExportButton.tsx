'use client'

import React, { useState } from 'react'
import { pdf } from '@react-pdf/renderer'
import { buildPdfReportData } from '@/lib/care-pdf-builder'
import { CarePdfDocument } from './CarePdfDocument'

interface Props {
  petId: string
}

export function CareExportButton({ petId }: Props) {
  const [loading, setLoading] = useState(false)
  const [rangedays, setRangedays] = useState<14 | 30 | 60 | 90 | 'all'>(30)

  async function handleExport() {
    setLoading(true)
    try {
      const data = buildPdfReportData(petId, rangedays)
      if (!data) {
        alert('No data found for this pet. Have you logged any entries?')
        return
      }
      const blob = await pdf(<CarePdfDocument data={data} />).toBlob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${data.petName.replace(/\s+/g, '-')}-tailcue-report-${new Date().toISOString().slice(0, 10)}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-3">
      <select
        value={rangedays}
        onChange={(e) => {
          const v = e.target.value
          setRangedays(v === 'all' ? 'all' : (Number(v) as 14 | 30 | 60 | 90))
        }}
        className="text-sm border border-stone-200 rounded-lg px-3 py-2 bg-white text-stone-700
          focus:outline-none focus:ring-2 focus:ring-amber-400"
      >
        <option value={14}>Last 14 days</option>
        <option value={30}>Last 30 days</option>
        <option value={60}>Last 60 days</option>
        <option value={90}>Last 90 days</option>
        <option value="all">All time</option>
      </select>

      <button
        onClick={handleExport}
        disabled={loading}
        className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-60
          text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
      >
        {loading ? (
          <>
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
            Generating&hellip;
          </>
        ) : (
          <>
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
            Export Vet Report
          </>
        )}
      </button>
    </div>
  )
}
