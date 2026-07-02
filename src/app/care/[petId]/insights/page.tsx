'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import {
  getPet,
  type CareLogEntry, type EpilepsyLogEntry, type CDSLogEntry, type DMLogEntry,
  type DiabetesLogEntry, type CHFLogEntry, type CKDLogEntry, type CushingsLogEntry,
  type OALogEntry, type HyperthyroidismLogEntry, type IBDLogEntry, type PetProfile,
} from '@/lib/care-storage'
import { computeDISHAAScore } from '@/lib/care-risk-engine'
import { TrendChart } from '@/components/care/TrendChart'

const MS_30D = 30 * 24 * 60 * 60 * 1000

// ── Stat Tile ─────────────────────────────────────────────────────────────

function StatTile({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-card border-[0.5px] border-border rounded-xl p-3">
      <p className="text-[12px] text-warm-muted mb-1">{label}</p>
      <p className="text-2xl font-bold text-foreground leading-none">{value}</p>
      {sub && <p className="text-[11px] text-warm-muted mt-1">{sub}</p>}
    </div>
  )
}

// ── Common stat tiles (all conditions) ────────────────────────────────────

function CommonStats({ logs, label }: { logs: CareLogEntry[]; label: string }) {
  const now = Date.now()
  const total = logs.length
  const last30 = logs.filter((l) => now - new Date(l.timestamp).getTime() <= MS_30D).length
  const lastTs = logs[0]?.timestamp
  const daysSinceLast = lastTs
    ? Math.floor((now - new Date(lastTs).getTime()) / (24 * 60 * 60 * 1000))
    : null

  if (total === 0) {
    return (
      <div className="bg-card border-[0.5px] border-border rounded-2xl p-4 text-center">
        <p className="text-sm text-warm-muted">No {label.toLowerCase()} logged yet.</p>
        <p className="text-xs text-warm-muted mt-1">Start logging to see insights here.</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-3 gap-3">
      <StatTile label="Total logged" value={total} />
      <StatTile label="Last 30 days" value={last30} />
      <StatTile
        label="Days since last"
        value={daysSinceLast === 0 ? 'Today' : daysSinceLast === null ? '—' : daysSinceLast}
        sub={daysSinceLast !== null && daysSinceLast > 0 ? 'days ago' : undefined}
      />
    </div>
  )
}

// ── Epilepsy Insights ─────────────────────────────────────────────────────

const TIME_BUCKETS = [
  { key: 'Night',     label: 'Night\n12–5am',   hours: [0, 1, 2, 3, 4, 5] },
  { key: 'Morning',   label: 'Morning\n6–11am',  hours: [6, 7, 8, 9, 10, 11] },
  { key: 'Afternoon', label: 'Afternoon\n12–5pm', hours: [12, 13, 14, 15, 16, 17] },
  { key: 'Evening',   label: 'Evening\n6–11pm',  hours: [18, 19, 20, 21, 22, 23] },
]

function EpilepsyInsights({ logs }: { logs: EpilepsyLogEntry[] }) {
  const now = Date.now()
  const total = logs.length
  const last30 = logs.filter((l) => now - new Date(l.timestamp).getTime() <= MS_30D).length
  const lastTs = logs[0]?.timestamp
  const daysSinceLast = lastTs
    ? Math.floor((now - new Date(lastTs).getTime()) / (24 * 60 * 60 * 1000))
    : null

  const logsWithDuration = logs.filter((l) => l.durationMinutes > 0)
  const avgDuration = logsWithDuration.length > 0
    ? Math.round(logsWithDuration.reduce((s, l) => s + l.durationMinutes, 0) / logsWithDuration.length)
    : null
  const logsWithRecovery = logs.filter((l) => l.postIctalMinutes > 0)
  const avgRecovery = logsWithRecovery.length > 0
    ? Math.round(logsWithRecovery.reduce((s, l) => s + l.postIctalMinutes, 0) / logsWithRecovery.length)
    : null

  const timeOfDayData = TIME_BUCKETS.map(({ key, hours }) => ({
    name: key,
    count: logs.filter((l) => hours.includes(new Date(l.timestamp).getHours())).length,
  }))

  const monthCounts = new Map<string, number>()
  for (const l of logs) {
    const m = l.date.slice(0, 7)
    monthCounts.set(m, (monthCounts.get(m) ?? 0) + 1)
  }
  const last12 = Array.from({ length: 12 }, (_, i) => {
    const d = new Date()
    d.setDate(1)
    d.setMonth(d.getMonth() - (11 - i))
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleDateString('en-US', { month: 'short' })
    return { name: label, count: monthCounts.get(key) ?? 0 }
  })

  if (total === 0) {
    return (
      <div className="bg-card border-[0.5px] border-border rounded-2xl p-4 text-center">
        <p className="text-sm text-warm-muted">No seizures logged yet.</p>
        <p className="text-xs text-warm-muted mt-1">Start logging to see patterns here.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <StatTile
          label="Days seizure-free"
          value={daysSinceLast === null ? '—' : daysSinceLast === 0 ? 'Today' : daysSinceLast}
        />
        <StatTile label="Last 30 days" value={last30} sub="seizures" />
        <StatTile label="Total logged" value={total} />
      </div>

      {(avgDuration !== null || avgRecovery !== null) && (
        <div className="grid grid-cols-2 gap-3">
          {avgDuration !== null && (
            <StatTile label="Avg duration" value={`${avgDuration} min`} />
          )}
          {avgRecovery !== null && (
            <StatTile label="Avg recovery" value={`${avgRecovery} min`} />
          )}
        </div>
      )}

      <div className="bg-card border-[0.5px] border-border rounded-2xl p-4">
        <p className="text-xs font-semibold text-warm-muted uppercase tracking-wide mb-4">
          Time of Day
        </p>
        <p className="text-[11px] text-warm-muted mb-3">
          Share patterns with your vet — timing alone does not explain seizures.
        </p>
        <ResponsiveContainer width="100%" height={140}>
          <BarChart data={timeOfDayData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'hsl(var(--warm-muted))' }} />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 10, fill: 'hsl(var(--warm-muted))' }}
            />
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid hsl(var(--border))' }}
              formatter={(v) => [`${v} seizure${v === 1 ? '' : 's'}`, 'Count']}
            />
            <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-card border-[0.5px] border-border rounded-2xl p-4">
        <p className="text-xs font-semibold text-warm-muted uppercase tracking-wide mb-4">
          Monthly Count — Last 12 Months
        </p>
        <ResponsiveContainer width="100%" height={140}>
          <BarChart data={last12} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'hsl(var(--warm-muted))' }} />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 10, fill: 'hsl(var(--warm-muted))' }}
            />
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid hsl(var(--border))' }}
              formatter={(v) => [`${v} seizure${v === 1 ? '' : 's'}`, 'Count']}
            />
            <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// ── Trend-based Insights ──────────────────────────────────────────────────

function TrendInsights({
  petId,
  logs,
  getValue,
  unit,
  refLines,
}: {
  petId: string
  logs: CareLogEntry[]
  getValue: (l: CareLogEntry) => number
  unit: string
  refLines: { y: number; stroke: string; label: string }[]
}) {
  if (logs.length === 0) {
    return (
      <div className="bg-card border-[0.5px] border-border rounded-2xl p-4 text-center">
        <p className="text-sm text-warm-muted">No readings logged yet.</p>
        <p className="text-xs text-warm-muted mt-1">Start logging to see your trend.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <TrendChart
        logs={logs}
        getValue={getValue}
        unit={unit}
        refLines={refLines}
        defaultRange="30d"
      />
      <Link
        href={`/care/${petId}/history`}
        className="block text-center text-xs font-medium text-primary hover:underline"
      >
        View full history →
      </Link>
    </div>
  )
}

// ── DM Insights ───────────────────────────────────────────────────────────

function DMInsights({ petId, logs }: { petId: string; logs: DMLogEntry[] }) {
  const now = Date.now()
  const total = logs.length
  const last30 = logs.filter((l) => now - new Date(l.timestamp).getTime() <= MS_30D).length
  const lastTs = logs[0]?.timestamp
  const daysSinceLast = lastTs
    ? Math.floor((now - new Date(lastTs).getTime()) / (24 * 60 * 60 * 1000))
    : null

  if (total === 0) {
    return (
      <div className="bg-card border-[0.5px] border-border rounded-2xl p-4 text-center">
        <p className="text-sm text-warm-muted">No check-ins logged yet.</p>
        <p className="text-xs text-warm-muted mt-1">Log weekly check-ins to track progression.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <StatTile label="Total check-ins" value={total} />
        <StatTile label="Last 30 days" value={last30} />
        <StatTile
          label="Days since last"
          value={daysSinceLast === 0 ? 'Today' : daysSinceLast === null ? '—' : daysSinceLast}
        />
      </div>
      <Link
        href={`/care/${petId}/history`}
        className="block text-center text-xs font-medium text-primary hover:underline"
      >
        View full history →
      </Link>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function InsightsPage() {
  const params = useParams()
  const router = useRouter()
  const petId = params.petId as string

  const [mounted, setMounted] = useState(false)
  const [profile, setProfile] = useState<PetProfile | null>(null)
  const [logs, setLogs] = useState<CareLogEntry[]>([])

  useEffect(() => {
    setMounted(true)
    getPet(petId).then((record) => {
      if (!record) { router.replace('/care'); return }
      setProfile(record.profile)
      setLogs(record.logs)
    })
  }, [petId, router])

  if (!mounted || !profile) return null

  const condition = profile.condition
  const isEpilepsy = condition === 'epilepsy'
  const isCDS = condition === 'cognitive_dysfunction'
  const isDM = condition === 'degenerative_myelopathy'
  const isDiabetes = condition === 'feline_diabetes'
  const isCHF = condition === 'chf'
  const isCKD = condition === 'chronic_kidney_disease'
  const isCushings = condition === 'cushings_disease'
  const isOA = condition === 'osteoarthritis'
  const isHyperthyroidism = condition === 'feline_hyperthyroidism'
  const isIBD = condition === 'ibd'

  const conditionLogs = logs.filter((l): l is Exclude<CareLogEntry, { type: 'medication_given' }> =>
    !('type' in l && (l as { type?: string }).type === 'medication_given') && l.condition === condition
  ) as CareLogEntry[]

  const epilepsyLogs = logs.filter((l): l is EpilepsyLogEntry => l.condition === 'epilepsy')
  const cdsLogs = logs.filter((l): l is CDSLogEntry => l.condition === 'cognitive_dysfunction')
  const dmLogs = logs.filter((l): l is DMLogEntry => l.condition === 'degenerative_myelopathy')

  const trendConfig = isDiabetes
    ? {
        getValue: (l: CareLogEntry) => (l.condition === 'feline_diabetes' ? (l as DiabetesLogEntry).bloodGlucose : 0),
        unit: 'mg/dL',
        refLines: [
          { y: 80,  stroke: '#22c55e', label: '80' },
          { y: 250, stroke: '#22c55e', label: '250' },
        ],
      }
    : isCHF
    ? {
        getValue: (l: CareLogEntry) => (l.condition === 'chf' ? (l as CHFLogEntry).srrBpm : 0),
        unit: 'bpm',
        refLines: [
          { y: 30, stroke: '#f59e0b', label: '30' },
          { y: 35, stroke: '#ef4444', label: '35' },
        ],
      }
    : isCKD
    ? {
        getValue: (l: CareLogEntry) => (l.condition === 'chronic_kidney_disease' ? (l as CKDLogEntry).lethargyScore : 0),
        unit: 'lethargy (1–5)',
        refLines: [
          { y: 3, stroke: '#f59e0b', label: '3' },
          { y: 4, stroke: '#ef4444', label: '4' },
        ],
      }
    : isCushings
    ? {
        getValue: (l: CareLogEntry) => (l.condition === 'cushings_disease' ? (l as CushingsLogEntry).lethargyScore : 0),
        unit: 'lethargy (1–5)',
        refLines: [
          { y: 3, stroke: '#f59e0b', label: '3' },
          { y: 4, stroke: '#ef4444', label: '4' },
        ],
      }
    : isOA
    ? {
        getValue: (l: CareLogEntry) => (l.condition === 'osteoarthritis' ? (l as OALogEntry).overallMobilityScore : 0),
        unit: 'mobility (1–5)',
        refLines: [{ y: 4, stroke: '#f59e0b', label: '4' }],
      }
    : isHyperthyroidism
    ? {
        getValue: (l: CareLogEntry) => (l.condition === 'feline_hyperthyroidism' ? (l as HyperthyroidismLogEntry).lethargyScore : 0),
        unit: 'lethargy (1–5)',
        refLines: [
          { y: 3, stroke: '#f59e0b', label: '3' },
          { y: 4, stroke: '#ef4444', label: '4' },
        ],
      }
    : isIBD
    ? {
        getValue: (l: CareLogEntry) => (l.condition === 'ibd' ? (l as IBDLogEntry).vomitingCount : 0),
        unit: 'vomit episodes',
        refLines: [
          { y: 2, stroke: '#f59e0b', label: '2' },
          { y: 3, stroke: '#ef4444', label: '3' },
        ],
      }
    : isCDS
    ? {
        getValue: (l: CareLogEntry) => computeDISHAAScore(l as CDSLogEntry),
        unit: 'DISHAA (0–12)',
        refLines: [
          { y: 4, stroke: '#f59e0b', label: '4' },
          { y: 8, stroke: '#ef4444', label: '8' },
        ],
      }
    : null

  return (
    <div className="min-h-screen bg-background flex flex-col md:pl-[220px]">
      <header className="bg-card border-b border-border px-4 py-3 flex items-center gap-3">
        <Link
          href={`/care/${petId}`}
          className="flex items-center gap-1 text-xs text-stone-400 hover:text-stone-600 transition-colors shrink-0"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Dashboard
        </Link>
        <span className="text-stone-200">|</span>
        <span className="text-sm font-semibold text-foreground">Insights</span>
      </header>

      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-6 space-y-6 pb-24 md:pb-8">

        {isEpilepsy ? (
          <EpilepsyInsights logs={epilepsyLogs} />
        ) : isDM ? (
          <>
            <CommonStats logs={dmLogs} label="Check-ins" />
            <DMInsights petId={petId} logs={dmLogs} />
          </>
        ) : trendConfig ? (
          <>
            <CommonStats logs={conditionLogs} label="Readings" />
            <TrendInsights
              petId={petId}
              logs={isCDS ? cdsLogs as CareLogEntry[] : conditionLogs}
              getValue={trendConfig.getValue}
              unit={trendConfig.unit}
              refLines={trendConfig.refLines}
            />
          </>
        ) : null}

        <p className="text-xs text-stone-400 text-center leading-relaxed px-2">
          Patterns shown here are for your records only — always follow your veterinarian&apos;s guidance.
        </p>
      </main>
    </div>
  )
}
