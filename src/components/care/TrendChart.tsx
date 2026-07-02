'use client'

import { useState, useMemo } from 'react'
import {
  ComposedChart, LineChart, Line, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ResponsiveContainer,
} from 'recharts'
import type { CareLogEntry } from '@/lib/care-storage'

type ChartRange = '24h' | '7d' | '30d' | '90d'

export interface RefLine {
  y: number
  stroke: string
  label: string
}

interface PointsResult {
  mode: 'points'
  data: { timestamp: string; value: number }[]
}

interface DailyPoint {
  date: string
  avg: number
  min: number
  max: number
}

interface DailyResult {
  mode: 'daily'
  data: DailyPoint[]
}

const MS_PER_RANGE: Record<ChartRange, number> = {
  '24h': 1  * 24 * 60 * 60 * 1000,
  '7d':  7  * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
  '90d': 90 * 24 * 60 * 60 * 1000,
}

function getChartDataForRange(
  logs: CareLogEntry[],
  range: ChartRange,
  getValue: (l: CareLogEntry) => number,
): PointsResult | DailyResult {
  const cutoff = Date.now() - MS_PER_RANGE[range]
  const filtered = logs.filter((l) => new Date(l.timestamp).getTime() >= cutoff)

  if (range === '24h' || range === '7d') {
    return {
      mode: 'points',
      data: filtered
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
        .map((l) => ({ timestamp: l.timestamp, value: getValue(l) })),
    }
  }

  const byDate = new Map<string, number[]>()
  for (const l of filtered) {
    const vals = byDate.get(l.date) ?? []
    vals.push(getValue(l))
    byDate.set(l.date, vals)
  }

  const data: DailyPoint[] = Array.from(byDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, vals]) => ({
      date,
      avg: Math.round(vals.reduce((s, v) => s + v, 0) / vals.length),
      min: Math.min(...vals),
      max: Math.max(...vals),
    }))

  return { mode: 'daily', data }
}

const CHART_RANGES: ChartRange[] = ['24h', '7d', '30d', '90d']

export function TrendChart({
  logs,
  getValue,
  unit,
  refLines,
  defaultRange = '7d',
}: {
  logs: CareLogEntry[]
  getValue: (l: CareLogEntry) => number
  unit: string
  refLines: RefLine[]
  defaultRange?: ChartRange
}) {
  const [range, setRange] = useState<ChartRange>(defaultRange)
  const result = useMemo(() => getChartDataForRange(logs, range, getValue), [logs, range, getValue])
  const isEmpty = result.data.length < 2

  return (
    <div className="bg-card border-[0.5px] border-border rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-warm-muted uppercase tracking-wide">Trend</p>
        <div className="flex rounded-xl overflow-hidden border border-border">
          {CHART_RANGES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                range === r
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-card text-warm-muted hover:bg-secondary'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {isEmpty ? (
        <p className="text-sm text-warm-muted py-6 text-center">
          Not enough data yet for this range.
        </p>
      ) : result.mode === 'points' ? (
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={result.data} margin={{ top: 8, right: 8, bottom: 0, left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="timestamp"
              type="category"
              tick={{ fontSize: 10, fill: 'hsl(var(--warm-muted))' }}
              tickFormatter={(ts: string) =>
                new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
              }
              interval="preserveStartEnd"
            />
            <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--warm-muted))' }} domain={['auto', 'auto']} />
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid hsl(var(--border))' }}
              formatter={(value) => [`${value} ${unit}`, 'Reading']}
              labelFormatter={(ts) => {
                const d = new Date(String(ts))
                return (
                  d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
                  ', ' +
                  d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
                )
              }}
              labelStyle={{ color: 'hsl(var(--warm-muted))', marginBottom: 4 }}
            />
            {refLines.map((rl) => (
              <ReferenceLine
                key={rl.y}
                y={rl.y}
                stroke={rl.stroke}
                strokeDasharray="4 2"
                label={{ value: rl.label, fontSize: 9, fill: rl.stroke, position: 'right' }}
              />
            ))}
            <Line
              type="monotone"
              dataKey="value"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              dot={{ r: 3, fill: 'hsl(var(--primary))', strokeWidth: 0 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <ResponsiveContainer width="100%" height={180}>
          <ComposedChart data={result.data} margin={{ top: 8, right: 8, bottom: 0, left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="date"
              type="category"
              tick={{ fontSize: 10, fill: 'hsl(var(--warm-muted))' }}
              tickFormatter={(d: string) =>
                new Date(`${d}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
              }
              interval="preserveStartEnd"
            />
            <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--warm-muted))' }} domain={['auto', 'auto']} />
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid hsl(var(--border))' }}
              formatter={(value, name) => {
                if (name === 'Range') {
                  const arr = value as [number, number]
                  return [`${arr[0]}–${arr[1]} ${unit}`, 'Range']
                }
                return [`${value} ${unit}`, 'Daily Avg']
              }}
              labelFormatter={(d) =>
                new Date(`${String(d)}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
              }
              labelStyle={{ color: 'hsl(var(--warm-muted))', marginBottom: 4 }}
            />
            {refLines.map((rl) => (
              <ReferenceLine
                key={rl.y}
                y={rl.y}
                stroke={rl.stroke}
                strokeDasharray="4 2"
                label={{ value: rl.label, fontSize: 9, fill: rl.stroke, position: 'right' }}
              />
            ))}
            <Area
              type="monotone"
              dataKey={(d: DailyPoint) => [d.min, d.max]}
              name="Range"
              fill="hsl(var(--primary))"
              fillOpacity={0.15}
              stroke="none"
            />
            <Line
              type="monotone"
              dataKey="avg"
              name="Daily Avg"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              dot={{ r: 3, fill: 'hsl(var(--primary))', strokeWidth: 0 }}
              activeDot={{ r: 5 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
