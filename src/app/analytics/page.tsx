'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { Clock, CheckCircle2, TrendingUp } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { TimeChart, type TimeChartDatum } from '@/components/analytics/TimeChart'
import { cn, formatDuration } from '@/lib/utils'
import type { Subject } from '@/types/database'

type DateRangeDays = 7 | 30 | 90

const RANGE_OPTIONS: { label: string; days: DateRangeDays }[] = [
  { label: '7 days', days: 7 },
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
]

const NO_SUBJECT_COLOR = '#94a3b8' // slate-400
const PDF_COLOR = '#4f46e5' // indigo-600
const PPT_COLOR = '#0d9488' // teal-600

interface ReviewLogRow {
  duration_seconds: number
  review_completed: boolean
  documents: { subject_id: string | null } | null
}

interface DocumentTypeRow {
  file_type: 'pdf' | 'ppt' | 'pptx'
}

export default function AnalyticsPage() {
  const supabase = createClient()

  const [rangeDays, setRangeDays] = useState<DateRangeDays>(30)
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [logs, setLogs] = useState<ReviewLogRow[]>([])
  const [documentTypes, setDocumentTypes] = useState<DocumentTypeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadAnalytics = useCallback(async () => {
    setLoading(true)
    setError(null)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setError('You must be signed in to view analytics.')
      setLoading(false)
      return
    }

    const cutoffIso = new Date(Date.now() - rangeDays * 24 * 60 * 60 * 1000).toISOString()

    const [subjectsRes, logsRes, docsRes] = await Promise.all([
      supabase.from('subjects').select('*').eq('user_id', user.id).order('name', { ascending: true }),
      supabase
        .from('review_log')
        .select('duration_seconds, review_completed, documents(subject_id)')
        .eq('user_id', user.id)
        .gte('started_at', cutoffIso),
      // File type mix reflects the whole library, not just the selected
      // date range — "how many PDFs vs PPTs do I have" isn't a time-series question.
      supabase.from('documents').select('file_type').eq('user_id', user.id).is('deleted_at', null),
    ])

    if (subjectsRes.error) {
      setError(subjectsRes.error.message)
      setLoading(false)
      return
    }
    if (logsRes.error) {
      setError(logsRes.error.message)
      setLoading(false)
      return
    }

    setSubjects(subjectsRes.data ?? [])
    setLogs((logsRes.data ?? []) as unknown as ReviewLogRow[])
    setDocumentTypes((docsRes.data ?? []) as DocumentTypeRow[])
    setLoading(false)
  }, [supabase, rangeDays])

  useEffect(() => {
    loadAnalytics()
  }, [loadAnalytics])

  // --- Time by subject -------------------------------------------------
  const subjectBreakdown = useMemo(() => {
    const secondsBySubject = new Map<string, number>()
    const reviewsBySubject = new Map<string, number>()

    for (const log of logs) {
      const subjectId = log.documents?.subject_id ?? '__none__'
      secondsBySubject.set(subjectId, (secondsBySubject.get(subjectId) ?? 0) + log.duration_seconds)
      if (log.review_completed) {
        reviewsBySubject.set(subjectId, (reviewsBySubject.get(subjectId) ?? 0) + 1)
      }
    }

    const bySubjectId = new Map(subjects.map((s) => [s.id, s]))
    const allIds = new Set([...secondsBySubject.keys(), ...subjects.map((s) => s.id)])

    const rows = Array.from(allIds).map((id) => {
      const subject = bySubjectId.get(id)
      return {
        subjectId: id,
        name: subject?.name ?? 'No subject',
        color: subject?.color ?? NO_SUBJECT_COLOR,
        seconds: secondsBySubject.get(id) ?? 0,
        reviews: reviewsBySubject.get(id) ?? 0,
      }
    })

    return rows.sort((a, b) => b.seconds - a.seconds)
  }, [logs, subjects])

  const chartData: TimeChartDatum[] = subjectBreakdown
    .filter((row) => row.seconds > 0)
    .map(({ subjectId, name, color, seconds }) => ({ subjectId, name, color, seconds }))

  const maxSeconds = Math.max(...subjectBreakdown.map((r) => r.seconds), 1)

  // --- Stats -------------------------------------------------------------
  const totalSeconds = logs.reduce((sum, log) => sum + log.duration_seconds, 0)
  const totalReviews = logs.filter((log) => log.review_completed).length
  const avgPerDaySeconds = totalSeconds / rangeDays

  // --- File type breakdown ------------------------------------------------
  const pdfCount = documentTypes.filter((d) => d.file_type === 'pdf').length
  const pptCount = documentTypes.filter((d) => d.file_type === 'ppt' || d.file_type === 'pptx').length
  const totalDocs = pdfCount + pptCount

  const fileTypeData = [
    { name: 'PDFs', value: pdfCount, color: PDF_COLOR },
    { name: 'PPTs', value: pptCount, color: PPT_COLOR },
  ].filter((d) => d.value > 0)

  if (loading) {
    return (
      <div className="flex flex-col gap-6 p-4 sm:p-6">
        <div className="h-8 w-48 animate-pulse rounded bg-slate-100" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
        <div className="h-72 animate-pulse rounded-xl bg-slate-100" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-2 p-10 text-center">
        <p className="text-sm font-medium text-slate-700">Couldn&apos;t load analytics</p>
        <p className="text-sm text-slate-500">{error}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      {/* Header + date range selector */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-slate-900">Analytics</h1>
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1">
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.days}
              type="button"
              onClick={() => setRangeDays(opt.days)}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                rangeDays === opt.days
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-500">Total time</span>
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                <Clock className="h-4 w-4" aria-hidden="true" />
              </span>
            </div>
            <span className="text-3xl font-semibold text-slate-900">{formatDuration(totalSeconds)}</span>
            <p className="text-sm text-slate-500">Over the last {rangeDays} days</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-500">Total reviews</span>
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-50 text-green-600">
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              </span>
            </div>
            <span className="text-3xl font-semibold text-slate-900">{totalReviews}</span>
            <p className="text-sm text-slate-500">Marked as reviewed</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-500">Avg per day</span>
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-50 text-orange-500">
                <TrendingUp className="h-4 w-4" aria-hidden="true" />
              </span>
            </div>
            <span className="text-3xl font-semibold text-slate-900">{formatDuration(avgPerDaySeconds)}</span>
            <p className="text-sm text-slate-500">Reading time / day</p>
          </CardContent>
        </Card>
      </div>

      {/* Time by subject + file type breakdown */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Time by Subject</CardTitle>
          </CardHeader>
          <CardContent>
            <TimeChart data={chartData} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>File Types</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {totalDocs === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">No documents yet.</p>
            ) : (
              <>
                <p className="text-sm text-slate-600">
                  You have{' '}
                  <span className="font-semibold text-slate-900">
                    {pdfCount} {pdfCount === 1 ? 'PDF' : 'PDFs'}
                  </span>{' '}
                  and{' '}
                  <span className="font-semibold text-slate-900">
                    {pptCount} {pptCount === 1 ? 'PPT' : 'PPTs'}
                  </span>
                </p>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={fileTypeData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={40}
                      outerRadius={70}
                      paddingAngle={2}
                    >
                      {fileTypeData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value, name) => [`${value ?? 0}`, `${name}`]} />
                    <Legend
                      verticalAlign="bottom"
                      height={24}
                      iconType="circle"
                      iconSize={8}
                      wrapperStyle={{ fontSize: 12 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Subject breakdown list */}
      <Card>
        <CardHeader>
          <CardTitle>Subject Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {subjectBreakdown.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-5 py-12 text-center">
              <p className="text-sm font-medium text-slate-700">No subjects yet</p>
              <p className="text-sm text-slate-500">Create a subject to start tracking time by topic.</p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {subjectBreakdown.map((row) => (
                <li key={row.subjectId} className="flex items-center gap-3 px-5 py-3">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: row.color }}
                    aria-hidden="true"
                  />
                  <span className="w-32 shrink-0 truncate text-sm font-medium text-slate-800">
                    {row.name}
                  </span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(row.seconds / maxSeconds) * 100}%`,
                        backgroundColor: row.color,
                      }}
                    />
                  </div>
                  <span className="w-16 shrink-0 text-right text-xs text-slate-500 tabular-nums">
                    {formatDuration(row.seconds)}
                  </span>
                  <span className="w-20 shrink-0 text-right text-xs text-slate-400 tabular-nums">
                    {row.reviews} {row.reviews === 1 ? 'review' : 'reviews'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}