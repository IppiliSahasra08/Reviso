'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Flame,
  FileText,
  Clock,
  ArrowRight,
  Inbox,
  CheckCircle2,
  BookOpenCheck,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { useSession } from '@/components/providers/SessionProvider'
import { createClient } from '@/lib/supabase/client'
import { cn, formatDate, formatDuration, stageNames } from '@/lib/utils'

function calculateStreak(logs: { started_at: string }[]): number {
  if (!logs || logs.length === 0) return 0
  const dates = Array.from(
    new Set(
      logs.map((log) => new Date(log.started_at).toDateString())
    )
  ).map((d) => new Date(d))

  dates.sort((a, b) => b.getTime() - a.getTime())

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  const current = dates[0]
  if (current.getTime() < yesterday.getTime()) {
    return 0
  }

  let streak = 1
  for (let i = 1; i < dates.length; i++) {
    const prev = new Date(dates[i - 1])
    prev.setDate(prev.getDate() - 1)
    const curr = dates[i]
    if (curr.getTime() === prev.getTime()) {
      streak++
    } else if (curr.getTime() > prev.getTime()) {
      continue
    } else {
      break
    }
  }
  return streak
}

export default function DashboardPage() {
  const router = useRouter()
  const { user, loading: sessionLoading } = useSession()

  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ dueToday: 0, totalDocuments: 0, streakDays: 0 })
  const [subjectBreakdown, setSubjectBreakdown] = useState<{ name: string; count: number; color: string }[]>([])
  const [dueTodayList, setDueTodayList] = useState<any[]>([])
  const [recentActivity, setRecentActivity] = useState<any[]>([])

  useEffect(() => {
    if (sessionLoading || !user) return
    const userId = user.id
    let cancelled = false

    async function loadDashboardData() {
      const supabase = createClient()

      // 1. Fetch all documents for stats & breakdown
      const { data: allDocs } = await (supabase
        .from('documents') as any)
        .select('id, title, next_review_date, current_stage, page_count, subject_id, subjects(id, name, color)')
        .eq('user_id', userId)
        .is('deleted_at', null)

      // 2. Fetch all review logs for streak & recent activity
      const { data: allLogs } = await (supabase
        .from('review_log') as any)
        .select('id, started_at, duration_seconds, documents(id, title, subjects(name))')
        .eq('user_id', userId)
        .order('started_at', { ascending: false })

      if (cancelled) return

      // Calculate stats
      const totalDocuments = allDocs ? allDocs.length : 0
      const nowIso = new Date().toISOString()
      const dueDocs = (allDocs ?? []).filter(
        (d: any) => d.next_review_date && d.next_review_date <= nowIso
      )
      const dueToday = dueDocs.length
      const streakDays = calculateStreak(allLogs ?? [])

      setStats({ dueToday, totalDocuments, streakDays })

      // Calculate subject breakdown
      const breakdownMap: Record<string, { count: number; color: string }> = {}
      for (const doc of allDocs ?? []) {
        const sub = doc.subjects
        const name = sub?.name ?? 'No Subject'
        const color = sub?.color ?? '#64748b'
        if (!breakdownMap[name]) {
          breakdownMap[name] = { count: 0, color }
        }
        breakdownMap[name].count++
      }
      const breakdown = Object.entries(breakdownMap).map(([name, val]) => ({
        name,
        count: val.count,
        color: val.color,
      }))
      setSubjectBreakdown(breakdown)

      // Map due list
      const dueList = dueDocs.map((d: any) => ({
        id: d.id,
        title: d.title,
        subject: d.subjects?.name ?? 'No Subject',
        subjectColor: d.subjects?.color ?? '#555555',
        stage: d.current_stage ?? 0,
        pageCount: d.page_count ?? 0,
      }))
      setDueTodayList(dueList)

      // Map recent activity
      const recent = (allLogs ?? []).map((log: any) => ({
        id: log.id,
        title: log.documents?.title ?? 'Deleted Document',
        subject: log.documents?.subjects?.name ?? 'No Subject',
        reviewedAt: log.started_at,
        durationSeconds: log.duration_seconds ?? 0,
      }))
      setRecentActivity(recent)

      setLoading(false)
    }

    loadDashboardData()
    return () => {
      cancelled = true
    }
  }, [user, sessionLoading])

  if (sessionLoading || loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-indigo-600" />
      </div>
    )
  }

  const firstName =
    (user?.user_metadata?.full_name as string | undefined)?.split(' ')[0] ??
    user?.email?.split('@')[0] ??
    'there'

  const maxSubjectCount = subjectBreakdown.length > 0 ? Math.max(...subjectBreakdown.map((s) => s.count)) : 0

  return (
    <div className="flex flex-col gap-8 p-4 sm:p-6">
      {/* Welcome section */}
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">
          Welcome back, {firstName} 👋
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {stats.dueToday > 0
            ? `You have ${stats.dueToday} document${stats.dueToday === 1 ? '' : 's'} due for review today.`
            : "You're all caught up — nothing due today."}
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Due today */}
        <Card>
          <CardContent className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-500">Due today</span>
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                <Clock className="h-4 w-4" aria-hidden="true" />
              </span>
            </div>
            <span className="text-3xl font-semibold text-slate-900">
              {stats.dueToday}
            </span>
            <button
              type="button"
              onClick={() => router.push('/library?filter=due')}
              className="flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-700"
            >
              Review now
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </CardContent>
        </Card>

        {/* Total documents */}
        <Card>
          <CardContent className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-500">Total documents</span>
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                <FileText className="h-4 w-4" aria-hidden="true" />
              </span>
            </div>
            <span className="text-3xl font-semibold text-slate-900">
              {stats.totalDocuments}
            </span>
            <button
              type="button"
              onClick={() => router.push('/library')}
              className="flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-700"
            >
              View library
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </CardContent>
        </Card>

        {/* Documents by subject (mini chart) */}
        <Card>
          <CardContent className="flex flex-col gap-3">
            <span className="text-sm font-medium text-slate-500">By subject</span>
            <div className="flex flex-col gap-2">
              {subjectBreakdown.length === 0 ? (
                <p className="py-2 text-xs text-slate-400">No documents yet.</p>
              ) : (
                subjectBreakdown.map((subject) => (
                  <div key={subject.name} className="flex items-center gap-2">
                    <span className="w-24 shrink-0 truncate text-xs text-slate-600">
                      {subject.name}
                    </span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${maxSubjectCount > 0 ? (subject.count / maxSubjectCount) * 100 : 0}%`,
                          backgroundColor: subject.color,
                        }}
                      />
                    </div>
                    <span className="w-4 shrink-0 text-right text-xs text-slate-500">
                      {subject.count}
                    </span>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Reading streak */}
        <Card>
          <CardContent className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-500">Reading streak</span>
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-50 text-orange-500">
                <Flame className="h-4 w-4" aria-hidden="true" />
              </span>
            </div>
            <span className="text-3xl font-semibold text-slate-900">
              {stats.streakDays}
              <span className="ml-1 text-base font-normal text-slate-400">days</span>
            </span>
            <p className="text-sm text-slate-500">
              {stats.streakDays > 0 ? 'Keep it going – review today!' : 'Start your streak today!'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Due today */}
      <Card>
        <CardHeader>
          <CardTitle>Due Today</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {dueTodayList.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-5 py-12 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                <Inbox className="h-6 w-6" aria-hidden="true" />
              </span>
              <p className="text-sm font-medium text-slate-700">Nothing due today</p>
              <p className="text-sm text-slate-500">
                You&apos;re all caught up. Check back tomorrow.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {dueTodayList.map((doc) => (
                <li
                  key={doc.id}
                  className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <span
                      className="mt-1 h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: doc.subjectColor }}
                      aria-hidden="true"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">
                        {doc.title}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <Badge variant="default">{doc.subject}</Badge>
                        <span className="text-xs text-slate-400">
                          {stageNames[doc.stage]} · {doc.pageCount} pages
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2 self-end sm:self-auto">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => console.log('snooze', doc.id)}
                    >
                      Snooze
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => router.push(`/documents/${doc.id}`)}
                    >
                      Start review
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Recent activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {recentActivity.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-5 py-12 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                <BookOpenCheck className="h-6 w-6" aria-hidden="true" />
              </span>
              <p className="text-sm font-medium text-slate-700">No reviews yet</p>
              <p className="text-sm text-slate-500">
                Finish a review to see your activity here.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {recentActivity.slice(0, 5).map((entry) => (
                <li
                  key={`${entry.id}-${entry.reviewedAt}`}
                  className="flex items-center justify-between gap-3 px-5 py-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-50 text-green-600">
                      <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">
                        {entry.title}
                      </p>
                      <p className="text-xs text-slate-500">
                        {entry.subject} · {formatDate(entry.reviewedAt, { relative: true })}
                      </p>
                    </div>
                  </div>
                  <span
                    className={cn(
                      'shrink-0 text-sm font-medium text-slate-500'
                    )}
                  >
                    {formatDuration(entry.durationSeconds)}
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