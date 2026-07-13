'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Search, ArrowUpDown, Inbox, UploadCloud, SearchX } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { DocumentCard, type DocumentCardData } from './DocumentCard'
import { Button } from '@/components/ui/Button'
import { cn, stageNames } from '@/lib/utils'

type SortOption = 'date_added' | 'due_date' | 'title'
type FileTypeFilter = 'all' | 'pdf' | 'ppt'

interface SubjectOption {
  id: string
  name: string
  color: string
}

// Shape returned by the Supabase query below (documents joined to subjects).
interface DocumentRow {
  id: string
  title: string
  file_type: 'pdf' | 'ppt' | 'pptx'
  current_stage: number
  next_review_date: string
  last_reviewed_at: string | null
  uploaded_at: string
  subject_id: string | null
  subjects: { name: string; color: string } | null
}

export interface DocumentGridProps {
  /** Called when the empty-state "Upload a PDF" button is clicked. */
  onUploadClick?: () => void
}

const PAGE_SIZE = 24

export function DocumentGrid({ onUploadClick }: DocumentGridProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const [subjects, setSubjects] = useState<SubjectOption[]>([])
  const [documents, setDocuments] = useState<(DocumentRow & { id: string })[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters — subject/stage seed from the URL so the sidebar (in the parent
  // page) can deep-link into a filtered view, e.g. /library?subject=<id>.
  const [subjectFilter, setSubjectFilter] = useState(
    () => searchParams.get('subject') ?? 'all'
  )
  const [stageFilter, setStageFilter] = useState(() => searchParams.get('stage') ?? 'all')
  const [fileTypeFilter, setFileTypeFilter] = useState<FileTypeFilter>(
    () => (searchParams.get('type') as FileTypeFilter | null) ?? 'all'
  )
  const [dueOnlyFilter, setDueOnlyFilter] = useState(
    () => searchParams.get('filter') === 'due'
  )
  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [sort, setSort] = useState<SortOption>('due_date')

  // Debounce the search box so we're not querying on every keystroke.
  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(searchInput.trim()), 300)
    return () => clearTimeout(timeout)
  }, [searchInput])

  // Re-sync when the URL changes after mount (e.g. a sidebar link sets
  // ?subject=<id>). The lazy useState initializer above only covers the
  // very first render, so without this a same-page navigation from the
  // sidebar would be ignored.
  useEffect(() => {
    const subjectParam = searchParams.get('subject') ?? 'all'
    const stageParam = searchParams.get('stage') ?? 'all'
    const typeParam = (searchParams.get('type') as FileTypeFilter | null) ?? 'all'
    const isDueParam = searchParams.get('filter') === 'due'
    setSubjectFilter((prev) => (prev !== subjectParam ? subjectParam : prev))
    setStageFilter((prev) => (prev !== stageParam ? stageParam : prev))
    setFileTypeFilter((prev) => (prev !== typeParam ? typeParam : prev))
    setDueOnlyFilter(isDueParam)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  // Fetch the subject list once, to populate the dropdown.
  useEffect(() => {
    let cancelled = false

    async function loadSubjects() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const { data, error: subjectsError } = await supabase
        .from('subjects')
        .select('id, name, color')
        .eq('user_id', user.id)
        .order('name', { ascending: true })

      if (!cancelled && !subjectsError && data) {
        setSubjects(data)
      }
    }

    loadSubjects()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchDocuments = useCallback(async () => {
    setLoading(true)
    setError(null)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setDocuments([])
      setLoading(false)
      return
    }

    let query = supabase
      .from('documents')
      .select(
        'id, title, file_type, current_stage, next_review_date, last_reviewed_at, uploaded_at, subject_id, subjects(name, color)'
      )
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .limit(PAGE_SIZE)

    if (dueOnlyFilter) {
      query = (query as any).lte('next_review_date', new Date().toISOString())
    }

    if (subjectFilter !== 'all') {
      query = query.eq('subject_id', subjectFilter)
    }
    if (stageFilter !== 'all') {
      query = query.eq('current_stage', Number(stageFilter))
    }
    if (fileTypeFilter === 'pdf') {
      query = query.eq('file_type', 'pdf')
    } else if (fileTypeFilter === 'ppt') {
      query = query.in('file_type', ['ppt', 'pptx'])
    }
    if (debouncedSearch) {
      query = query.ilike('title', `%${debouncedSearch}%`)
    }

    if (sort === 'date_added') {
      query = query.order('uploaded_at', { ascending: false })
    } else if (sort === 'due_date') {
      query = query.order('next_review_date', { ascending: true })
    } else {
      query = query.order('title', { ascending: true })
    }

    const { data, error: fetchError } = await query

    if (fetchError) {
      setError(fetchError.message)
      setDocuments([])
    } else {
      setDocuments((data ?? []) as unknown as (DocumentRow & { id: string })[])
    }

    setLoading(false)
  }, [supabase, subjectFilter, stageFilter, fileTypeFilter, debouncedSearch, sort, dueOnlyFilter])

  useEffect(() => {
    fetchDocuments()
  }, [fetchDocuments])

  async function handleDelete(id: string) {
    // Optimistic removal — soft delete via deleted_at, recoverable server-side.
    setDocuments((prev) => prev.filter((doc) => doc.id !== id))

    const { error: deleteError } = await (supabase
      .from('documents') as any)
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)

    if (deleteError) {
      // Re-fetch to restore accurate state if the delete failed server-side.
      fetchDocuments()
    }
  }

  const hasActiveFilters =
    subjectFilter !== 'all' ||
    stageFilter !== 'all' ||
    fileTypeFilter !== 'all' ||
    debouncedSearch.length > 0

  const cards: DocumentCardData[] = useMemo(
    () =>
      documents.map((doc) => ({
        title: doc.title,
        fileType: doc.file_type,
        subject: {
          name: doc.subjects?.name ?? 'No subject',
          color: doc.subjects?.color ?? '#94a3b8',
        },
        currentStage: doc.current_stage,
        nextReviewDate: doc.next_review_date,
        lastReviewedAt: doc.last_reviewed_at,
        uploadedAt: doc.uploaded_at,
      })),
    [documents]
  )

  return (
    <div className="flex flex-col gap-5">
      {/* Toolbar: search, subject, stage, sort */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative flex-1 sm:min-w-[220px] sm:max-w-xs">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
          <input
            type="search"
            placeholder="Search documents…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <select
          value={subjectFilter}
          onChange={(e) => setSubjectFilter(e.target.value)}
          className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="all">All subjects</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>

        <select
          value={fileTypeFilter}
          onChange={(e) => setFileTypeFilter(e.target.value as FileTypeFilter)}
          className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="all">All files</option>
          <option value="pdf">PDFs</option>
          <option value="ppt">PPTs</option>
        </select>

        <select
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value)}
          className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="all">All stages</option>
          {stageNames.slice(1).map((name, i) => (
            <option key={name} value={i + 1}>
              {name}
            </option>
          ))}
        </select>

        <div className="relative sm:ml-auto">
          <ArrowUpDown
            className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortOption)}
            className="h-9 rounded-lg border border-slate-200 bg-white py-0 pl-8 pr-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="due_date">Sort: Due date</option>
            <option value="date_added">Sort: Date added</option>
            <option value="title">Sort: Title</option>
          </select>
        </div>
      </div>

      {/* Grid / skeleton / empty / error states */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="flex animate-pulse flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4"
            >
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-lg bg-slate-100" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 w-3/4 rounded bg-slate-100" />
                  <div className="h-2.5 w-1/2 rounded bg-slate-100" />
                </div>
              </div>
              <div className="h-1.5 w-full rounded-full bg-slate-100" />
              <div className="h-2.5 w-1/3 rounded bg-slate-100" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-5 py-10 text-center">
          <p className="text-sm font-medium text-red-700">Couldn&apos;t load documents</p>
          <p className="text-sm text-red-600">{error}</p>
          <Button variant="outline" size="sm" onClick={fetchDocuments} className="mt-2">
            Try again
          </Button>
        </div>
      ) : cards.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-16 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
            {hasActiveFilters ? (
              <SearchX className="h-6 w-6" aria-hidden="true" />
            ) : (
              <Inbox className="h-6 w-6" aria-hidden="true" />
            )}
          </span>
          {hasActiveFilters ? (
            <>
              <p className="text-sm font-medium text-slate-700">No documents match your filters</p>
              <p className="text-sm text-slate-500">Try a different search term or clear filters.</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => {
                  setSubjectFilter('all')
                  setStageFilter('all')
                  setFileTypeFilter('all')
                  setSearchInput('')
                }}
              >
                Clear filters
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-slate-700">Your library is empty</p>
              <p className="text-sm text-slate-500">Upload a PDF to start your first review cycle.</p>
              <Button variant="primary" size="sm" className="mt-2" onClick={onUploadClick}>
                <UploadCloud className="h-4 w-4" aria-hidden="true" />
                Upload a PDF
              </Button>
            </>
          )}
        </div>
      ) : (
        <div className={cn('grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3')}>
          {documents.map((doc, i) => (
            <DocumentCard
              key={doc.id}
              document={cards[i]}
              onOpen={() => router.push(`/documents/${doc.id}`)}
              onDelete={() => handleDelete(doc.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}