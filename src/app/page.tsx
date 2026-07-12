'use client'

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
import { cn, formatDate, formatDuration, stageNames } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Mock data — replace with Supabase queries once the documents/subjects
// tables are wired up (see src/types/database.ts).
// ---------------------------------------------------------------------------

const mockStats = {
  dueToday: 4,
  totalDocuments: 27,
  streakDays: 6,
}

const mockSubjectBreakdown = [
  { name: 'Machine Learning', count: 9, color: '#4f46e5' },
  { name: 'Quantum Computing', count: 6, color: '#7c3aed' },
  { name: 'Systems Design', count: 7, color: '#0d9488' },
  { name: 'Data Structures', count: 5, color: '#d97706' },
]

const mockDueToday = [
  {
    id: 'doc_1',
    title: 'Attention Is All You Need',
    subject: 'Machine Learning',
    subjectColor: '#4f46e5',
    stage: 3,
    pageCount: 15,
  },
  {
    id: 'doc_2',
    title: 'QAOA for Combinatorial Optimization',
    subject: 'Quantum Computing',
    subjectColor: '#7c3aed',
    stage: 2,
    pageCount: 22,
  },
  {
    id: 'doc_3',
    title: 'Designing Data-Intensive Applications — Ch. 5',
    subject: 'Systems Design',
    subjectColor: '#0d9488',
    stage: 4,
    pageCount: 34,
  },
  {
    id: 'doc_4',
    title: 'Red-Black Trees: A Refresher',
    subject: 'Data Structures',
    subjectColor: '#d97706',
    stage: 1,
    pageCount: 11,
  },
]

const mockRecentActivity = [
  {
    id: 'doc_5',
    title: 'RAGAS: Automated Evaluation of RAG',
    subject: 'Machine Learning',
    reviewedAt: '2026-07-11T14:20:00Z',
    durationSeconds: 1380,
  },
  {
    id: 'doc_6',
    title: 'NISQ-Era Algorithms Survey',
    subject: 'Quantum Computing',
    reviewedAt: '2026-07-11T09:05:00Z',
    durationSeconds: 2760,
  },
  {
    id: 'doc_2',
    title: 'QAOA for Combinatorial Optimization',
    subject: 'Quantum Computing',
    reviewedAt: '2026-07-10T19:40:00Z',
    durationSeconds: 900,
  },
  {
    id: 'doc_7',
    title: 'Consistent Hashing in Practice',
    subject: 'Systems Design',
    reviewedAt: '2026-07-10T11:15:00Z',
    durationSeconds: 660,
  },
  {
    id: 'doc_8',
    title: 'B+ Trees vs LSM Trees',
    subject: 'Data Structures',
    reviewedAt: '2026-07-09T16:50:00Z',
    durationSeconds: 1140,
  },
]

export default function DashboardPage() {
  const router = useRouter()
  const { user } = useSession()

  const firstName =
    (user?.user_metadata?.full_name as string | undefined)?.split(' ')[0] ??
    user?.email?.split('@')[0] ??
    'there'

  const maxSubjectCount = Math.max(...mockSubjectBreakdown.map((s) => s.count))

  return (
    <div className="flex flex-col gap-8 p-4 sm:p-6">
      {/* Welcome section */}
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">
          Welcome back, {firstName} 👋
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {mockStats.dueToday > 0
            ? `You have ${mockStats.dueToday} document${mockStats.dueToday === 1 ? '' : 's'} due for review today.`
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
              {mockStats.dueToday}
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
              {mockStats.totalDocuments}
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
              {mockSubjectBreakdown.map((subject) => (
                <div key={subject.name} className="flex items-center gap-2">
                  <span className="w-24 shrink-0 truncate text-xs text-slate-600">
                    {subject.name}
                  </span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(subject.count / maxSubjectCount) * 100}%`,
                        backgroundColor: subject.color,
                      }}
                    />
                  </div>
                  <span className="w-4 shrink-0 text-right text-xs text-slate-500">
                    {subject.count}
                  </span>
                </div>
              ))}
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
              {mockStats.streakDays}
              <span className="ml-1 text-base font-normal text-slate-400">days</span>
            </span>
            <p className="text-sm text-slate-500">Keep it going — review today!</p>
          </CardContent>
        </Card>
      </div>

      {/* Due today */}
      <Card>
        <CardHeader>
          <CardTitle>Due Today</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {mockDueToday.length === 0 ? (
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
              {mockDueToday.map((doc) => (
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
                      onClick={() => router.push(`/review/${doc.id}`)}
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
          {mockRecentActivity.length === 0 ? (
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
              {mockRecentActivity.slice(0, 5).map((entry) => (
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