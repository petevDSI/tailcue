'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Cat, Dog, Trash2 } from 'lucide-react'
import { TrendChart } from '@/components/care/TrendChart'
import {
  getPet, deleteLogEntry,
  type CareLogEntry, type DiabetesLogEntry, type CHFLogEntry,
  type CKDLogEntry, type CushingsLogEntry, type OALogEntry, type EpilepsyLogEntry,
  type HyperthyroidismLogEntry, type IBDLogEntry, type CDSLogEntry, type DMLogEntry,
  type PetProfile,
} from '@/lib/care-storage'
import {
  evaluateGlucoseRisk, evaluateCHFRisk,
  evaluateCKDRisk, evaluateCushingsRisk, evaluateOARisk,
  evaluateHyperthyroidismRisk, evaluateIBDRisk, evaluateCDSRisk, computeDISHAAScore, evaluateDMRisk,
} from '@/lib/care-risk-engine'
import { CareExportButton } from '@/components/care/CareExportButton'
import Footer from '@/components/footer'

const PAGE_SIZE = 30

// ── Helpers ───────────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function appetiteStripColor(appetite: string): string {
  if (appetite === 'poor') return 'bg-amber-100 text-amber-700 border-amber-200'
  return 'bg-stone-100 text-stone-500 border-stone-200'
}

function appetiteShortLabel(appetite: string): string {
  if (appetite === 'poor') return 'Poor'
  if (appetite === 'ravenous') return 'Rav.'
  return 'Norm.'
}

function lethargyStripColor(level: number): string {
  if (level >= 4) return 'bg-amber-100 text-amber-700 border-amber-200'
  return 'bg-stone-100 text-stone-500 border-stone-200'
}

// ── 7-Day Appetite Strip ──────────────────────────────────────────────────

function AppetiteStrip({ logs }: { logs: DiabetesLogEntry[] }) {
  const days: string[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    days.push(d.toISOString().slice(0, 10))
  }

  const byDay = new Map<string, DiabetesLogEntry>()
  for (const log of [...logs].reverse()) {
    byDay.set(log.date, log)
  }

  return (
    <div className="bg-white rounded-xl border border-stone-200 p-4">
      <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1">
        7-Day Appetite
      </p>
      <p className="text-xs text-stone-400 mb-3">
        Appetite changes can signal glucose swings — share patterns with your vet.
      </p>
      <div className="flex gap-1.5">
        {days.map((date) => {
          const log = byDay.get(date)
          const mmdd = date.slice(5).replace('-', '/')
          return (
            <div key={date} className="flex-1 flex flex-col items-center gap-1">
              <div
                className={`w-full rounded-md border text-center py-1.5 text-xs font-medium ${
                  log
                    ? appetiteStripColor(log.appetite)
                    : 'bg-stone-50 text-stone-300 border-stone-100'
                }`}
              >
                {log ? appetiteShortLabel(log.appetite) : '—'}
              </div>
              <span className="text-[10px] text-stone-400">{mmdd}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── 7-Day Lethargy Strip ──────────────────────────────────────────────────

function LethargyStrip({ logs }: { logs: CHFLogEntry[] }) {
  const days: string[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    days.push(d.toISOString().slice(0, 10))
  }

  const byDay = new Map<string, CHFLogEntry>()
  for (const log of [...logs].reverse()) {
    byDay.set(log.date, log)
  }

  return (
    <div className="bg-white rounded-xl border border-stone-200 p-4">
      <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1">
        7-Day Lethargy
      </p>
      <p className="text-xs text-stone-400 mb-3">
        Increasing lethargy alongside elevated breathing rate warrants a vet check.
      </p>
      <div className="flex gap-1.5">
        {days.map((date) => {
          const log = byDay.get(date)
          const mmdd = date.slice(5).replace('-', '/')
          return (
            <div key={date} className="flex-1 flex flex-col items-center gap-1">
              <div
                className={`w-full rounded-md border text-center py-1.5 text-xs font-medium ${
                  log
                    ? lethargyStripColor(log.lethargyLevel)
                    : 'bg-stone-50 text-stone-300 border-stone-100'
                }`}
              >
                {log ? log.lethargyLevel : '—'}
              </div>
              <span className="text-[10px] text-stone-400">{mmdd}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── CKD History List ──────────────────────────────────────────────────────

function CKDHistoryList({ logs, pendingDeleteId, onDelete, onSetPending }: {
  logs: CKDLogEntry[]
  pendingDeleteId: string | null
  onDelete: (id: string) => void
  onSetPending: (id: string | null) => void
}) {
  if (logs.length === 0) return null
  return (
    <ul className="divide-y divide-stone-100">
      {logs.map((log) => {
        const risk = evaluateCKDRisk(log)
        const isConfirming = pendingDeleteId === log.id
        return (
          <li key={log.id} className="py-3 flex items-start gap-3">
            <div className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${
              risk.level === 'critical' ? 'bg-red-400' : risk.level === 'caution' ? 'bg-yellow-400' : 'bg-green-400'
            }`} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-stone-900 text-sm">{log.vomitingCount} vomit</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${
                  log.skinTurgor === 'tented' ? 'bg-red-100 text-red-700 border-red-300'
                  : log.skinTurgor === 'sticky' ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : 'bg-stone-100 text-stone-500 border-stone-200'
                }`}>
                  skin: {log.skinTurgor}
                </span>
                {log.subqFluidMl !== null && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium border bg-blue-50 text-blue-700 border-blue-200">
                    {log.subqFluidMl} mL SubQ
                  </span>
                )}
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${risk.badgeColor}`}>
                  {risk.level}
                </span>
              </div>
              <p className="text-xs text-stone-400 mt-0.5">
                {fmtDate(log.date)} &middot; {fmtTime(log.timestamp)}
                {` · appetite: ${log.appetite} · lethargy ${log.lethargyScore}/5`}
              </p>
            </div>
            {isConfirming ? (
              <div className="flex gap-1.5 shrink-0">
                <button onClick={() => onDelete(log.id)}
                  className="text-xs font-medium text-red-600 hover:text-red-700 px-2 py-1 rounded border border-red-200 hover:bg-red-50 transition-colors">
                  Delete
                </button>
                <button onClick={() => onSetPending(null)}
                  className="text-xs font-medium text-stone-500 hover:text-stone-700 px-2 py-1 rounded border border-stone-200 hover:bg-stone-50 transition-colors">
                  Cancel
                </button>
              </div>
            ) : (
              <button onClick={() => onSetPending(log.id)}
                className="text-stone-300 hover:text-red-400 transition-colors shrink-0 mt-0.5" aria-label="Delete entry">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </li>
        )
      })}
    </ul>
  )
}

// ── Cushing's History List ────────────────────────────────────────────────

function CushingsHistoryList({ logs, pendingDeleteId, onDelete, onSetPending }: {
  logs: CushingsLogEntry[]
  pendingDeleteId: string | null
  onDelete: (id: string) => void
  onSetPending: (id: string | null) => void
}) {
  if (logs.length === 0) return null
  return (
    <ul className="divide-y divide-stone-100">
      {logs.map((log) => {
        const risk = evaluateCushingsRisk(log)
        const isConfirming = pendingDeleteId === log.id
        return (
          <li key={log.id} className="py-3 flex items-start gap-3">
            <div className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${
              risk.level === 'critical' ? 'bg-red-400' : risk.level === 'caution' ? 'bg-yellow-400' : 'bg-green-400'
            }`} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-stone-900 text-sm">lethargy {log.lethargyScore}/5</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${
                  log.waterIntake === 'excessive' ? 'bg-red-100 text-red-700 border-red-300'
                  : log.waterIntake === 'elevated' ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : 'bg-stone-100 text-stone-500 border-stone-200'
                }`}>
                  water: {log.waterIntake}
                </span>
                {log.medicationGiven && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium border bg-green-50 text-green-700 border-green-200">
                    med ✓
                  </span>
                )}
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${risk.badgeColor}`}>
                  {risk.level}
                </span>
              </div>
              <p className="text-xs text-stone-400 mt-0.5">
                {fmtDate(log.date)} &middot; {fmtTime(log.timestamp)}
                {log.vomitingOrDiarrhea && ' · GI signs'}
                {log.indoorAccidents && ' · accidents'}
              </p>
            </div>
            {isConfirming ? (
              <div className="flex gap-1.5 shrink-0">
                <button onClick={() => onDelete(log.id)}
                  className="text-xs font-medium text-red-600 hover:text-red-700 px-2 py-1 rounded border border-red-200 hover:bg-red-50 transition-colors">
                  Delete
                </button>
                <button onClick={() => onSetPending(null)}
                  className="text-xs font-medium text-stone-500 hover:text-stone-700 px-2 py-1 rounded border border-stone-200 hover:bg-stone-50 transition-colors">
                  Cancel
                </button>
              </div>
            ) : (
              <button onClick={() => onSetPending(log.id)}
                className="text-stone-300 hover:text-red-400 transition-colors shrink-0 mt-0.5" aria-label="Delete entry">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </li>
        )
      })}
    </ul>
  )
}

// ── OA History List ───────────────────────────────────────────────────────

function OAHistoryList({ logs, pendingDeleteId, onDelete, onSetPending }: {
  logs: OALogEntry[]
  pendingDeleteId: string | null
  onDelete: (id: string) => void
  onSetPending: (id: string | null) => void
}) {
  if (logs.length === 0) return null
  return (
    <ul className="divide-y divide-stone-100">
      {logs.map((log) => {
        const risk = evaluateOARisk(log)
        const isConfirming = pendingDeleteId === log.id
        return (
          <li key={log.id} className="py-3 flex items-start gap-3">
            <div className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${
              risk.level === 'critical' ? 'bg-red-400' : risk.level === 'caution' ? 'bg-yellow-400' : 'bg-green-400'
            }`} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-stone-900 text-sm">mobility {log.overallMobilityScore}/5</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${
                  log.easOfRising === 'refused' ? 'bg-red-100 text-red-700 border-red-300'
                  : log.easOfRising === 'hesitant' ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : 'bg-stone-100 text-stone-500 border-stone-200'
                }`}>
                  rising: {log.easOfRising}
                </span>
                {log.painMedGiven && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium border bg-green-50 text-green-700 border-green-200">
                    pain med ✓
                  </span>
                )}
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${risk.badgeColor}`}>
                  {risk.level}
                </span>
              </div>
              <p className="text-xs text-stone-400 mt-0.5">
                {fmtDate(log.date)} &middot; {fmtTime(log.timestamp)}
              </p>
            </div>
            {isConfirming ? (
              <div className="flex gap-1.5 shrink-0">
                <button onClick={() => onDelete(log.id)}
                  className="text-xs font-medium text-red-600 hover:text-red-700 px-2 py-1 rounded border border-red-200 hover:bg-red-50 transition-colors">
                  Delete
                </button>
                <button onClick={() => onSetPending(null)}
                  className="text-xs font-medium text-stone-500 hover:text-stone-700 px-2 py-1 rounded border border-stone-200 hover:bg-stone-50 transition-colors">
                  Cancel
                </button>
              </div>
            ) : (
              <button onClick={() => onSetPending(log.id)}
                className="text-stone-300 hover:text-red-400 transition-colors shrink-0 mt-0.5" aria-label="Delete entry">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </li>
        )
      })}
    </ul>
  )
}

// ── Hyperthyroidism History List ──────────────────────────────────────────

function HyperthyroidismHistoryList({ logs, pendingDeleteId, onDelete, onSetPending }: {
  logs: HyperthyroidismLogEntry[]
  pendingDeleteId: string | null
  onDelete: (id: string) => void
  onSetPending: (id: string | null) => void
}) {
  if (logs.length === 0) return null
  return (
    <ul className="divide-y divide-stone-100">
      {logs.map((log) => {
        const risk = evaluateHyperthyroidismRisk(log)
        const isConfirming = pendingDeleteId === log.id
        return (
          <li key={log.id} className="py-3 flex items-start gap-3">
            <div className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${
              risk.level === 'critical' ? 'bg-red-400' : risk.level === 'caution' ? 'bg-yellow-400' : 'bg-green-400'
            }`} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-stone-900 text-sm">{log.vomitingCount} vomit</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${
                  log.appetite === 'ravenous' ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : log.appetite === 'reduced' ? 'bg-stone-100 text-stone-500 border-stone-200'
                  : 'bg-stone-100 text-stone-500 border-stone-200'
                }`}>
                  appetite: {log.appetite}
                </span>
                {log.medicationGiven && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium border bg-green-50 text-green-700 border-green-200">
                    med ✓
                  </span>
                )}
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${risk.badgeColor}`}>
                  {risk.level}
                </span>
              </div>
              <p className="text-xs text-stone-400 mt-0.5">
                {fmtDate(log.date)} &middot; {fmtTime(log.timestamp)}
                {` · lethargy ${log.lethargyScore}/5`}
                {log.facialScratching && ' · facial scratching'}
              </p>
            </div>
            {isConfirming ? (
              <div className="flex gap-1.5 shrink-0">
                <button onClick={() => onDelete(log.id)}
                  className="text-xs font-medium text-red-600 hover:text-red-700 px-2 py-1 rounded border border-red-200 hover:bg-red-50 transition-colors">Delete</button>
                <button onClick={() => onSetPending(null)}
                  className="text-xs font-medium text-stone-500 hover:text-stone-700 px-2 py-1 rounded border border-stone-200 hover:bg-stone-50 transition-colors">Cancel</button>
              </div>
            ) : (
              <button onClick={() => onSetPending(log.id)}
                className="text-stone-300 hover:text-red-400 transition-colors shrink-0 mt-0.5" aria-label="Delete entry">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </li>
        )
      })}
    </ul>
  )
}

// ── IBD History List ──────────────────────────────────────────────────────

function IBDHistoryList({ logs, pendingDeleteId, onDelete, onSetPending }: {
  logs: IBDLogEntry[]
  pendingDeleteId: string | null
  onDelete: (id: string) => void
  onSetPending: (id: string | null) => void
}) {
  if (logs.length === 0) return null
  return (
    <ul className="divide-y divide-stone-100">
      {logs.map((log) => {
        const risk = evaluateIBDRisk(log)
        const isConfirming = pendingDeleteId === log.id
        const stoolColor = log.stoolConsistency === 'bloody'
          ? 'bg-red-100 text-red-700 border-red-300'
          : log.stoolConsistency === 'watery'
          ? 'bg-amber-100 text-amber-700 border-amber-200'
          : log.stoolConsistency === 'soft'
          ? 'bg-yellow-50 text-yellow-700 border-yellow-200'
          : 'bg-stone-100 text-stone-500 border-stone-200'
        return (
          <li key={log.id} className="py-3 flex items-start gap-3">
            <div className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${
              risk.level === 'critical' ? 'bg-red-400' : risk.level === 'caution' ? 'bg-yellow-400' : 'bg-green-400'
            }`} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-stone-900 text-sm">{log.vomitingCount} vomit</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${stoolColor}`}>
                  stool: {log.stoolConsistency}
                </span>
                {!log.dietCompliance && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium border bg-amber-50 text-amber-700 border-amber-200">
                    diet lapse
                  </span>
                )}
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${risk.badgeColor}`}>
                  {risk.level}
                </span>
              </div>
              <p className="text-xs text-stone-400 mt-0.5">
                {fmtDate(log.date)} &middot; {fmtTime(log.timestamp)}
                {` · appetite: ${log.appetite} · lethargy ${log.lethargyScore}/5`}
              </p>
            </div>
            {isConfirming ? (
              <div className="flex gap-1.5 shrink-0">
                <button onClick={() => onDelete(log.id)}
                  className="text-xs font-medium text-red-600 hover:text-red-700 px-2 py-1 rounded border border-red-200 hover:bg-red-50 transition-colors">Delete</button>
                <button onClick={() => onSetPending(null)}
                  className="text-xs font-medium text-stone-500 hover:text-stone-700 px-2 py-1 rounded border border-stone-200 hover:bg-stone-50 transition-colors">Cancel</button>
              </div>
            ) : (
              <button onClick={() => onSetPending(log.id)}
                className="text-stone-300 hover:text-red-400 transition-colors shrink-0 mt-0.5" aria-label="Delete entry">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </li>
        )
      })}
    </ul>
  )
}

// ── CDS History View ──────────────────────────────────────────────────────

function CDSHistoryView({ logs, pendingDeleteId, onDelete, onSetPending }: {
  logs: CDSLogEntry[]
  pendingDeleteId: string | null
  onDelete: (id: string) => void
  onSetPending: (id: string | null) => void
}) {
  return (
    <>
      {logs.length >= 2 && (
        <TrendChart
          logs={logs as unknown as CareLogEntry[]}
          getValue={(l) => computeDISHAAScore(l as unknown as CDSLogEntry)}
          unit="DISHAA (0–12)"
          refLines={[
            { y: 4, stroke: '#f59e0b', label: '4' },
            { y: 8, stroke: '#ef4444', label: '8' },
          ]}
        />
      )}
      <div className="bg-white rounded-xl border border-stone-200 p-4">
        <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-3">All Weekly Check-Ins</p>
        {logs.length === 0 ? (
          <p className="text-sm text-stone-400">No check-ins logged yet.</p>
        ) : (
          <ul className="divide-y divide-stone-100">
            {logs.map((log) => {
              const score = computeDISHAAScore(log)
              const risk = evaluateCDSRisk(log)
              const isConfirming = pendingDeleteId === log.id
              return (
                <li key={log.id} className="py-3 flex items-start gap-3">
                  <div className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${
                    risk.level === 'critical' ? 'bg-red-400' : risk.level === 'caution' ? 'bg-yellow-400' : 'bg-green-400'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-stone-900 text-sm">DISHAA {score}/12</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${risk.badgeColor}`}>
                        {risk.displayLabel ?? risk.level}
                      </span>
                    </div>
                    <p className="text-xs text-stone-400 mt-0.5">
                      {fmtDate(log.date)} &middot; {fmtTime(log.timestamp)}
                    </p>
                    {log.notes && <p className="text-xs text-stone-500 mt-0.5 italic">{log.notes}</p>}
                  </div>
                  {isConfirming ? (
                    <div className="flex gap-1.5 shrink-0">
                      <button onClick={() => onDelete(log.id)}
                        className="text-xs font-medium text-red-600 hover:text-red-700 px-2 py-1 rounded border border-red-200 hover:bg-red-50 transition-colors">Delete</button>
                      <button onClick={() => onSetPending(null)}
                        className="text-xs font-medium text-stone-500 hover:text-stone-700 px-2 py-1 rounded border border-stone-200 hover:bg-stone-50 transition-colors">Cancel</button>
                    </div>
                  ) : (
                    <button onClick={() => onSetPending(log.id)}
                      className="text-stone-300 hover:text-red-400 transition-colors shrink-0 mt-0.5" aria-label="Delete entry">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </>
  )
}

// ── DM History View ───────────────────────────────────────────────────────

function DMHistoryView({ logs, pendingDeleteId, onDelete, onSetPending }: {
  logs: DMLogEntry[]
  pendingDeleteId: string | null
  onDelete: (id: string) => void
  onSetPending: (id: string | null) => void
}) {
  return (
    <div className="bg-white rounded-xl border border-stone-200 p-4">
      <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-3">All Weekly Check-Ins</p>
      {logs.length === 0 ? (
        <p className="text-sm text-stone-400">No check-ins logged yet.</p>
      ) : (
        <ul className="divide-y divide-stone-100">
          {logs.map((log) => {
            const risk = evaluateDMRisk(log)
            const isConfirming = pendingDeleteId === log.id
            return (
              <li key={log.id} className="py-3 flex items-start gap-3">
                <div className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${
                  risk.level === 'critical' ? 'bg-red-400' : risk.level === 'caution' ? 'bg-yellow-400' : 'bg-green-400'
                }`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-stone-900 text-sm">{log.hindLimbWalking.replace(/_/g, ' ')}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${
                      log.continenceStatus === 'incontinent' ? 'bg-red-100 text-red-700 border-red-300'
                      : log.continenceStatus === 'occasional_accident' ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : 'bg-stone-100 text-stone-500 border-stone-200'
                    }`}>
                      {log.continenceStatus.replace(/_/g, ' ')}
                    </span>
                    {log.rehabDoneToday && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium border bg-green-50 text-green-700 border-green-200">
                        rehab ✓
                      </span>
                    )}
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${risk.badgeColor}`}>
                      {risk.displayLabel ?? risk.level}
                    </span>
                  </div>
                  <p className="text-xs text-stone-400 mt-0.5">
                    {fmtDate(log.date)} &middot; {fmtTime(log.timestamp)}
                    {` · rising: ${log.canRiseUnassisted.replace(/_/g, ' ')}`}
                  </p>
                  {log.notes && <p className="text-xs text-stone-500 mt-0.5 italic">{log.notes}</p>}
                </div>
                {isConfirming ? (
                  <div className="flex gap-1.5 shrink-0">
                    <button onClick={() => onDelete(log.id)}
                      className="text-xs font-medium text-red-600 hover:text-red-700 px-2 py-1 rounded border border-red-200 hover:bg-red-50 transition-colors">Delete</button>
                    <button onClick={() => onSetPending(null)}
                      className="text-xs font-medium text-stone-500 hover:text-stone-700 px-2 py-1 rounded border border-stone-200 hover:bg-stone-50 transition-colors">Cancel</button>
                  </div>
                ) : (
                  <button onClick={() => onSetPending(log.id)}
                    className="text-stone-300 hover:text-red-400 transition-colors shrink-0 mt-0.5" aria-label="Delete entry">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

// ── Epilepsy History List ─────────────────────────────────────────────────

function EpilepsyHistoryView({ logs }: { logs: EpilepsyLogEntry[] }) {
  const byMonth = new Map<string, number>()
  for (const log of logs) {
    const month = log.date.slice(0, 7)
    byMonth.set(month, (byMonth.get(month) ?? 0) + 1)
  }
  const months = Array.from(byMonth.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, 6)

  return (
    <>
      {months.length > 0 && (
        <div className="bg-white rounded-xl border border-stone-200 p-4">
          <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-3">Monthly Count</p>
          <div className="space-y-2">
            {months.map(([month, count]) => {
              const label = new Date(`${month}-15`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
              return (
                <div key={month} className="flex items-center gap-3">
                  <span className="text-xs text-stone-500 w-28 shrink-0">{label}</span>
                  <div className="flex-1 bg-stone-100 rounded-full h-2 overflow-hidden">
                    <div className="h-full bg-amber-400 rounded-full" style={{ width: `${Math.min(100, count * 10)}%` }} />
                  </div>
                  <span className="text-xs font-semibold text-stone-700 w-6 text-right">{count}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
      <div className="bg-white rounded-xl border border-stone-200 p-4">
        <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-3">All Seizure Events</p>
        {logs.length === 0 ? (
          <p className="text-sm text-stone-400">No seizures logged yet.</p>
        ) : (
          <ul className="divide-y divide-stone-100">
            {logs.map((log) => (
              <li key={log.id} className="py-3">
                <div className="flex items-center gap-2 flex-wrap mb-0.5">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${
                    log.severity === 'severe'   ? 'bg-red-100 text-red-800 border-red-300' :
                    log.severity === 'moderate' ? 'bg-orange-100 text-orange-800 border-orange-300' :
                    'bg-yellow-100 text-yellow-800 border-yellow-300'
                  }`}>
                    {log.severity}
                  </span>
                  <span className={`font-semibold text-sm ${log.durationMinutes >= 5 ? 'text-red-700' : 'text-stone-900'}`}>
                    {log.durationMinutes} min
                  </span>
                  {log.durationMinutes >= 5 && (
                    <span className="text-xs text-red-600 font-medium">⚠ 5+ min</span>
                  )}
                  {log.postIctalMinutes > 0 && (
                    <span className="text-xs text-stone-400">{log.postIctalMinutes} min recovery</span>
                  )}
                </div>
                <p className="text-xs text-stone-400">{fmtDate(log.date)} at {fmtTime(log.timestamp)}</p>
                {log.notes && <p className="text-xs text-stone-500 mt-0.5 italic">{log.notes}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function PetHistoryPage() {
  const params = useParams()
  const router = useRouter()
  const petId = params.petId as string

  const [mounted, setMounted] = useState(false)
  const [profile, setProfile] = useState<PetProfile | null>(null)
  const [logs, setLogs] = useState<CareLogEntry[]>([])
  const [visible, setVisible] = useState(PAGE_SIZE)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  useEffect(() => {
    setMounted(true)
    getPet(petId).then((record) => {
      if (!record) {
        router.replace('/care')
        return
      }
      setProfile(record.profile)
      setLogs(record.logs)
    })
  }, [petId, router])

  if (!mounted) return null

  if (!profile) return null

  function handleDelete(id: string) {
    setLogs((prev) => prev.filter((l) => l.id !== id))
    setPendingDeleteId(null)
    deleteLogEntry(petId, id)
  }

  const condition = profile.condition
  const isCHF = condition === 'chf'
  const isDiabetes = condition === 'feline_diabetes'
  const isCKD = condition === 'chronic_kidney_disease'
  const isCushings = condition === 'cushings_disease'
  const isOA = condition === 'osteoarthritis'
  const isEpilepsy = condition === 'epilepsy'
  const isHyperthyroidism = condition === 'feline_hyperthyroidism'
  const isIBD = condition === 'ibd'
  const isCDS = condition === 'cognitive_dysfunction'
  const isDM = condition === 'degenerative_myelopathy'
  const diabetesLogs = logs.filter((l): l is DiabetesLogEntry => l.condition === 'feline_diabetes')
  const chfLogs = logs.filter((l): l is CHFLogEntry => l.condition === 'chf')
  const ckdLogs = logs.filter((l): l is CKDLogEntry => l.condition === 'chronic_kidney_disease')
  const cushingsLogs = logs.filter((l): l is CushingsLogEntry => l.condition === 'cushings_disease')
  const oaLogs = logs.filter((l): l is OALogEntry => l.condition === 'osteoarthritis')
  const epilepsyLogs = logs.filter((l): l is EpilepsyLogEntry => l.condition === 'epilepsy')
  const hyperthyroidismLogs = logs.filter((l): l is HyperthyroidismLogEntry => l.condition === 'feline_hyperthyroidism')
  const ibdLogs = logs.filter((l): l is IBDLogEntry => l.condition === 'ibd')
  const cdsLogs = logs.filter((l): l is CDSLogEntry => l.condition === 'cognitive_dysfunction')
  const dmLogs = logs.filter((l): l is DMLogEntry => l.condition === 'degenerative_myelopathy')

  const chartConfig = isCHF
    ? {
        getValue: (l: CareLogEntry) => (l.condition === 'chf' ? l.srrBpm : 0),
        unit: 'bpm',
        refLines: [
          { y: 30, stroke: '#f59e0b', label: '30' },
          { y: 35, stroke: '#ef4444', label: '35' },
        ],
      }
    : isDiabetes
    ? {
        getValue: (l: CareLogEntry) => (l.condition === 'feline_diabetes' ? l.bloodGlucose : 0),
        unit: 'mg/dL',
        refLines: [
          { y: 80,  stroke: '#22c55e', label: '80' },
          { y: 250, stroke: '#22c55e', label: '250' },
        ],
      }
    : isCKD || isCushings
    ? {
        getValue: (l: CareLogEntry) => (
          l.condition === 'chronic_kidney_disease' ? l.lethargyScore
          : l.condition === 'cushings_disease' ? l.lethargyScore : 0
        ),
        unit: 'lethargy (1–5)',
        refLines: [
          { y: 3, stroke: '#f59e0b', label: '3' },
          { y: 4, stroke: '#ef4444', label: '4' },
        ],
      }
    : isOA
    ? {
        getValue: (l: CareLogEntry) => (l.condition === 'osteoarthritis' ? l.overallMobilityScore : 0),
        unit: 'mobility (1–5)',
        refLines: [
          { y: 4, stroke: '#f59e0b', label: '4' },
        ],
      }
    : isHyperthyroidism
    ? {
        getValue: (l: CareLogEntry) => (l.condition === 'feline_hyperthyroidism' ? l.lethargyScore : 0),
        unit: 'lethargy (1–5)',
        refLines: [
          { y: 3, stroke: '#f59e0b', label: '3' },
          { y: 4, stroke: '#ef4444', label: '4' },
        ],
      }
    : isIBD
    ? {
        getValue: (l: CareLogEntry) => (l.condition === 'ibd' ? l.vomitingCount : 0),
        unit: 'vomit episodes',
        refLines: [
          { y: 2, stroke: '#f59e0b', label: '2' },
          { y: 3, stroke: '#ef4444', label: '3' },
        ],
      }
    : null

  const conditionLogs = isCHF ? chfLogs : isDiabetes ? diabetesLogs
    : isCKD ? ckdLogs : isCushings ? cushingsLogs : isOA ? oaLogs
    : isHyperthyroidism ? hyperthyroidismLogs : isIBD ? ibdLogs
    : epilepsyLogs

  const SpeciesIcon = profile.species === 'dog' ? Dog : Cat
  const visibleLogs = logs.slice(0, visible)
  const remaining = logs.length - visible

  return (
    <div className="min-h-screen bg-background flex flex-col md:pl-[220px]">
      <header className="bg-white border-b border-stone-200 px-4 py-3 flex items-center gap-3">
        <Link
          href={`/care/${petId}`}
          className="flex items-center gap-1 text-xs text-stone-400 hover:text-stone-600 transition-colors shrink-0"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Dashboard
        </Link>
        <span className="text-stone-200">|</span>
        <SpeciesIcon className="w-5 h-5 text-amber-500" />
        <span className="font-semibold text-stone-800">Reading History</span>
      </header>

      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-6 space-y-6 pb-24 sm:pb-8">

        <div className="flex justify-end">
          <CareExportButton petId={petId} />
        </div>

        {isCHF && <LethargyStrip logs={chfLogs} />}
        {isDiabetes && <AppetiteStrip logs={diabetesLogs} />}

        {isEpilepsy ? (
          <EpilepsyHistoryView logs={epilepsyLogs} />
        ) : isCDS ? (
          <CDSHistoryView
            logs={cdsLogs}
            pendingDeleteId={pendingDeleteId}
            onDelete={handleDelete}
            onSetPending={setPendingDeleteId}
          />
        ) : isDM ? (
          <DMHistoryView
            logs={dmLogs}
            pendingDeleteId={pendingDeleteId}
            onDelete={handleDelete}
            onSetPending={setPendingDeleteId}
          />
        ) : (
          <>
            {chartConfig && (
              <TrendChart
                logs={conditionLogs as CareLogEntry[]}
                getValue={chartConfig.getValue}
                unit={chartConfig.unit}
                refLines={chartConfig.refLines}
              />
            )}

            {logs.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-stone-400 text-sm mb-3">No readings logged yet.</p>
                <Link href={`/care/${petId}`} className="text-amber-600 hover:text-amber-700 text-sm font-medium">
                  Log your first reading →
                </Link>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-stone-200 p-4">
                <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-3">All Readings</p>

                {/* Diabetes */}
                {isDiabetes && (
                  <ul className="divide-y divide-stone-100">
                    {visibleLogs.map((log) => {
                      if (log.condition !== 'feline_diabetes') return null
                      const risk = evaluateGlucoseRisk(log.bloodGlucose)
                      const isConfirming = pendingDeleteId === log.id
                      return (
                        <li key={log.id} className="py-3 flex items-start gap-3">
                          <div className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${risk.level === 'critical' ? 'bg-red-400' : risk.level === 'caution' ? 'bg-yellow-400' : 'bg-green-400'}`} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-stone-900 text-sm">{log.bloodGlucose} mg/dL</span>
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${risk.badgeColor}`}>{risk.level}</span>
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${log.appetite === 'poor' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-stone-100 text-stone-500 border-stone-200'}`}>{log.appetite}</span>
                            </div>
                            <p className="text-xs text-stone-400 mt-0.5">
                              {fmtDate(log.date)} &middot; {fmtTime(log.timestamp)}
                              {log.insulinUnits > 0 && ` · ${log.insulinUnits}u ${log.insulinType || 'insulin'}`}
                            </p>
                          </div>
                          {isConfirming ? (
                            <div className="flex gap-1.5 shrink-0">
                              <button onClick={() => handleDelete(log.id)} className="text-xs font-medium text-red-600 hover:text-red-700 px-2 py-1 rounded border border-red-200 hover:bg-red-50 transition-colors">Delete</button>
                              <button onClick={() => setPendingDeleteId(null)} className="text-xs font-medium text-stone-500 hover:text-stone-700 px-2 py-1 rounded border border-stone-200 hover:bg-stone-50 transition-colors">Cancel</button>
                            </div>
                          ) : (
                            <button onClick={() => setPendingDeleteId(log.id)} className="text-stone-300 hover:text-red-400 transition-colors shrink-0 mt-0.5" aria-label="Delete entry"><Trash2 className="w-4 h-4" /></button>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                )}

                {/* CHF */}
                {isCHF && (
                  <ul className="divide-y divide-stone-100">
                    {visibleLogs.map((log) => {
                      if (log.condition !== 'chf') return null
                      const risk = evaluateCHFRisk(log.srrBpm, profile.chfBaselineSRR ?? null, log.lethargyLevel)
                      const isConfirming = pendingDeleteId === log.id
                      return (
                        <li key={log.id} className="py-3 flex items-start gap-3">
                          <div className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${risk.level === 'critical' ? 'bg-red-400' : risk.level === 'caution' ? 'bg-yellow-400' : 'bg-green-400'}`} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-stone-900 text-sm">{log.srrBpm} bpm</span>
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${risk.badgeColor}`}>{risk.level}</span>
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${log.lethargyLevel >= 4 ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-stone-100 text-stone-500 border-stone-200'}`}>lethargy {log.lethargyLevel}</span>
                            </div>
                            <p className="text-xs text-stone-400 mt-0.5">{fmtDate(log.date)} &middot; {fmtTime(log.timestamp)}</p>
                          </div>
                          {isConfirming ? (
                            <div className="flex gap-1.5 shrink-0">
                              <button onClick={() => handleDelete(log.id)} className="text-xs font-medium text-red-600 hover:text-red-700 px-2 py-1 rounded border border-red-200 hover:bg-red-50 transition-colors">Delete</button>
                              <button onClick={() => setPendingDeleteId(null)} className="text-xs font-medium text-stone-500 hover:text-stone-700 px-2 py-1 rounded border border-stone-200 hover:bg-stone-50 transition-colors">Cancel</button>
                            </div>
                          ) : (
                            <button onClick={() => setPendingDeleteId(log.id)} className="text-stone-300 hover:text-red-400 transition-colors shrink-0 mt-0.5" aria-label="Delete entry"><Trash2 className="w-4 h-4" /></button>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                )}

                {/* CKD */}
                {isCKD && (
                  <CKDHistoryList
                    logs={ckdLogs.slice(0, visible)}
                    pendingDeleteId={pendingDeleteId}
                    onDelete={handleDelete}
                    onSetPending={setPendingDeleteId}
                  />
                )}

                {/* Cushing's */}
                {isCushings && (
                  <CushingsHistoryList
                    logs={cushingsLogs.slice(0, visible)}
                    pendingDeleteId={pendingDeleteId}
                    onDelete={handleDelete}
                    onSetPending={setPendingDeleteId}
                  />
                )}

                {/* OA */}
                {isOA && (
                  <OAHistoryList
                    logs={oaLogs.slice(0, visible)}
                    pendingDeleteId={pendingDeleteId}
                    onDelete={handleDelete}
                    onSetPending={setPendingDeleteId}
                  />
                )}

                {/* Hyperthyroidism */}
                {isHyperthyroidism && (
                  <HyperthyroidismHistoryList
                    logs={hyperthyroidismLogs.slice(0, visible)}
                    pendingDeleteId={pendingDeleteId}
                    onDelete={handleDelete}
                    onSetPending={setPendingDeleteId}
                  />
                )}

                {/* IBD */}
                {isIBD && (
                  <IBDHistoryList
                    logs={ibdLogs.slice(0, visible)}
                    pendingDeleteId={pendingDeleteId}
                    onDelete={handleDelete}
                    onSetPending={setPendingDeleteId}
                  />
                )}

                {remaining > 0 && (
                  <div className="mt-4 pt-3 border-t border-stone-100">
                    <button
                      onClick={() => setVisible((v) => v + PAGE_SIZE)}
                      className="w-full text-sm text-stone-500 hover:text-stone-700 font-medium py-2
                        rounded-xl border border-stone-200 hover:bg-stone-50 transition-colors"
                    >
                      Load {Math.min(PAGE_SIZE, remaining)} more
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>

      <Footer disclaimer="Tailcue Care is a logging tool to help you track your pet's condition at home. It does not provide medical advice or diagnoses. Always follow your veterinarian's guidance." />
    </div>
  )
}
