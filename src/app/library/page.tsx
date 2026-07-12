'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Plus, X, SlidersHorizontal } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { DocumentGrid } from '@/components/documents/DocumentGrid'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

interface SubjectOption {
  id: string
  name: string
  color: string
}

function FilterSidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const [subjects, setSubjects] = useState<SubjectOption[]>([])
  const activeSubject = searchParams.get('subject')

  useEffect(() => {
    let cancelled = false

    async function loadSubjects() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('subjects')
        .select('id, name, color')
        .eq('user_id', user.id)
        .order('name', { ascending: true })

      if (!cancelled && data) setSubjects(data)
    }

    loadSubjects()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function setSubjectParam(id: string | null) {
    const params = new URLSearchParams(searchParams.toString())
    if (id) {
      params.set('subject', id)
    } else {
      params.delete('subject')
    }
    router.push(`/library?${params.toString()}`)
    onNavigate?.()
  }

  return (
    <div className="flex flex-col gap-1">
      <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
        Subjects
      </p>
      <button
        type="button"
        onClick={() => setSubjectParam(null)}
        className={cn(
          'flex items-center rounded-lg px-2 py-1.5 text-left text-sm font-medium transition-colors',
          !activeSubject
            ? 'bg-indigo-50 text-indigo-700'
            : 'text-slate-600 hover:bg-slate-100'
        )}
      >
        All subjects
      </button>
      {subjects.map((subject) => (
        <button
          key={subject.id}
          type="button"
          onClick={() => setSubjectParam(subject.id)}
          className={cn(
            'flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm font-medium transition-colors',
            activeSubject === subject.id
              ? 'bg-indigo-50 text-indigo-700'
              : 'text-slate-600 hover:bg-slate-100'
          )}
        >
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: subject.color }}
            aria-hidden="true"
          />
          <span className="truncate">{subject.name}</span>
        </button>
      ))}
      {subjects.length === 0 && (
        <p className="px-2 text-sm text-slate-400">No subjects yet.</p>
      )}
    </div>
  )
}

export default function LibraryPage() {
  const router = useRouter()
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-slate-900">Library</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="lg:hidden"
            onClick={() => setMobileFiltersOpen(true)}
          >
            <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
            Filters
          </Button>
          <Button variant="primary" onClick={() => router.push('/library/upload')}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Upload
          </Button>
        </div>
      </div>

      <div className="flex items-start gap-6">
        {/* Desktop filter sidebar */}
        <aside className="hidden w-56 shrink-0 lg:block">
          <Suspense fallback={null}>
            <FilterSidebarContent />
          </Suspense>
        </aside>

        {/* Mobile filter drawer */}
        {mobileFiltersOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div
              className="fixed inset-0 bg-slate-900/40"
              onClick={() => setMobileFiltersOpen(false)}
              aria-hidden="true"
            />
            <div className="fixed inset-y-0 left-0 flex w-72 flex-col bg-white p-4 shadow-lg">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-900">Filters</h2>
                <button
                  type="button"
                  onClick={() => setMobileFiltersOpen(false)}
                  aria-label="Close filters"
                  className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>
              <Suspense fallback={null}>
                <FilterSidebarContent onNavigate={() => setMobileFiltersOpen(false)} />
              </Suspense>
            </div>
          </div>
        )}

        {/* Document grid */}
        <div className="min-w-0 flex-1">
          <Suspense fallback={null}>
            <DocumentGrid onUploadClick={() => router.push('/library/upload')} />
          </Suspense>
        </div>
      </div>
    </div>
  )
}