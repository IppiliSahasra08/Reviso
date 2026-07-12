'use client'

import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatDuration } from '@/lib/utils'

export interface TimeChartDatum {
  subjectId: string
  name: string
  color: string
  seconds: number
}

export interface TimeChartProps {
  data: TimeChartDatum[]
}

interface TooltipPayloadEntry {
  payload: TimeChartDatum
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayloadEntry[] }) {
  if (!active || !payload?.length) return null
  const datum = payload[0].payload

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-md">
      <div className="flex items-center gap-1.5 font-medium text-slate-900">
        <span
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ backgroundColor: datum.color }}
          aria-hidden="true"
        />
        {datum.name}
      </div>
      <p className="mt-0.5 text-slate-500">{formatDuration(datum.seconds)}</p>
    </div>
  )
}

/** Horizontal bar chart of reading time per subject, bars colored to match each subject. */
export function TimeChart({ data }: TimeChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-56 items-center justify-center text-sm text-slate-400">
        No reading time recorded in this range yet.
      </div>
    )
  }

  // Recharts sizes horizontal bars off the container height divided by row
  // count — clamp a sane minimum so a handful of subjects don't render as
  // oversized bars.
  const chartHeight = Math.max(56 * data.length, 180)

  return (
    <ResponsiveContainer width="100%" height={chartHeight}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 4 }}>
        <XAxis
          type="number"
          tickFormatter={(seconds: number) => formatDuration(seconds)}
          tick={{ fontSize: 12, fill: '#64748b' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={110}
          tick={{ fontSize: 12, fill: '#334155' }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: '#f1f5f9' }} />
        <Bar dataKey="seconds" radius={[0, 6, 6, 0]} maxBarSize={28}>
          {data.map((entry) => (
            <Cell key={entry.subjectId} fill={entry.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}