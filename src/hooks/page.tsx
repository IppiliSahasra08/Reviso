'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  PanelRightClose,
  PanelRightOpen,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/providers/Toaster'
import { useReadingTimer } from '@/hooks/useReadingTimer'
import { DocumentViewer } from '@/components/documents/DocumentViewer'
import { ReadingTimeDisplay } from '@/components/documents/ReadingTimeDisplay'
import { Button } from '@/components/ui/Button'
import { buildFolderTree, getBreadcrumbTrail } from '@/lib/folders'
import { cn, formatDate, stageNames } from '@/lib/utils'
import type { Document, Folder, Subject } from '@/types/database'

type DocumentWithSubject = Document & { subjects: Pick<Subject, 'id' | 'name' | 'color'> | null }

export default function DocumentPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClient()

  const [doc, setDoc] = useState<DocumentWithSubject | null>(null)
  const [folders, setFolders] = useState<Folder[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [marking, setMarking] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  // Independent of useReadingTimer's internal review_log checkpointing —
  // this marks when the "mark as reviewed" review session began, for the
  // completed review_log row the RPC writes.
  const [sessionStartedAt] = useState(() => new Date().toISOString())

  const timer = useReadingTimer(params.id)

  const loadDocument = useCallback(async () => {
    setLoading(true)
    setLoadError(null)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setLoadError('You must be signed in to view this document.')
      setLoading(false)
      return
    }

    const { data, error } = await supabase
      .from('documents')
      .select('*, subjects(id, name, color)')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .single()

    if (error || !data) {
      setLoadError(error?.message ?? 'Document not found.')
      setLoading(false)
      return
    }

    setDoc(data as DocumentWithSubject)

    if (data.folder_id && data.subject_id) {
      const { data: folderRows } = await supabase
        .from('folders')
        .select('*')
        .eq('subject_id', data.subject_id)
        .eq('user_id', user.id)
      setFolders(folderRows ?? [])
    } else {
      setFolders([])
    }

    setLoading(false)
  }, [supabase, params.id])

  useEffect(() => {
    loadDocument()
  }, [loadDocument])

  const folderTree = useMemo(() => buildFolderTree(folders), [folders])
  const breadcrumb = useMemo(
    () =>
      doc
        ? getBreadcrumbTrail(folderTree, doc.folder_id, doc.subjects?.name ?? 'Subject')
        : [],
    [folderTree, doc]
  )

  async function handleMarkReviewed() {
    if (!doc) return
    setMarking(true)

    const { error } = await supabase.rpc('mark_document_reviewed', {
      p_document_id: doc.id,
      p_started_at: sessionStartedAt,
      p_duration_seconds: timer.elapsedSeconds,
      p_pages_read: currentPage,
    })

    setMarking(false)

    if (error) {
      toast(error.message, 'error')
      return
    }

    timer.endSession()
    toast('Marked as reviewed — nice work!', 'success')
    router.push(doc.subject_id ? `/folders/${doc.subject_id}` : '/library')
  }

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center gap-2 text-sm text-slate-400">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        Loading document…
      </div>
    )
  }

  if (loadError || !doc) {
    return (
      <div className="flex h-[calc(100vh-4rem)] flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-sm font-medium text-slate-700">Couldn&apos;t load this document</p>
        <p className="text-sm text-slate-500">{loadError}</p>
        <Button variant="outline" size="sm" onClick={() => router.push('/library')}>
          Back to library
        </Button>
      </div>
    )
  }

  const fileType = doc.file_type

  return (
    <div className="relative flex h-[calc(100vh-4rem)] flex-col">
      {/* Top bar: back link + breadcrumb + sidebar toggle */}
      <div className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-2 sm:px-6">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Go back"
          className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        </button>

        <nav aria-label="Document path" className="flex min-w-0 flex-1 items-center gap-1 text-sm text-slate-500">
          {breadcrumb.map((segment, i) => {
            const isLast = i === breadcrumb.length - 1
            return (
              <span key={segment.id ?? 'root'} className="flex min-w-0 items-center gap-1">
                {i === 0 && doc.subject_id ? (
                  <Link href={`/folders/${doc.subject_id}`} className="truncate hover:text-slate-800">
                    {segment.title}
                  </Link>
                ) : (
                  <span className={cn('truncate', isLast && 'font-medium text-slate-800')}>
                    {segment.title}
                  </span>
                )}
                {!isLast && <span aria-hidden="true">/</span>}
              </span>
            )
          })}
        </nav>

        <button
          type="button"
          onClick={() => setSidebarOpen((v) => !v)}
          aria-label={sidebarOpen ? 'Hide details' : 'Show details'}
          className="shrink-0 rounded-md p-1.5 text-slate-500 hover:bg-slate-100"
        >
          {sidebarOpen ? (
            <PanelRightClose className="h-4 w-4" aria-hidden="true" />
          ) : (
            <PanelRightOpen className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      </div>

      {/* Body: viewer + collapsible sidebar */}
      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1 p-4">
          <DocumentViewer
            document={{
              id: doc.id,
              title: doc.title,
              fileType,
              filePath: doc.file_url,
              pageCount: doc.page_count,
            }}
            onPageChange={(page) => setCurrentPage(page)}
          />
        </div>

        {sidebarOpen && (
          <aside className="w-72 shrink-0 overflow-y-auto border-l border-slate-200 bg-white p-4">
            <div className="flex flex-col gap-4">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">{doc.title}</h3>
                {doc.subjects && (
                  <div className="mt-1 flex items-center gap-1.5">
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: doc.subjects.color }}
                      aria-hidden="true"
                    />
                    <span className="text-xs text-slate-500">{doc.subjects.name}</span>
                  </div>
                )}
              </div>

              <dl className="flex flex-col gap-2.5 text-sm">
                <div className="flex items-center justify-between">
                  <dt className="text-slate-500">Stage</dt>
                  <dd className="font-medium text-slate-900">
                    {doc.current_stage > 0 ? stageNames[doc.current_stage] : 'Not started'}
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-slate-500">Next review</dt>
                  <dd className="font-medium text-slate-900">
                    {formatDate(doc.next_review_date)}
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-slate-500">Reviews so far</dt>
                  <dd className="font-medium text-slate-900">{doc.review_count}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-slate-500">Last reviewed</dt>
                  <dd className="font-medium text-slate-900">
                    {formatDate(doc.last_reviewed_at, { relative: true })}
                  </dd>
                </div>
              </dl>

              <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <div>
                  <p className="text-xs text-slate-500">Reading time this session</p>
                  <ReadingTimeDisplay
                    elapsedSeconds={timer.elapsedSeconds}
                    className="text-sm font-semibold text-slate-900"
                  />
                </div>
              </div>
            </div>
          </aside>
        )}
      </div>

      {/* Floating "Mark as Reviewed" button */}
      <div className="pointer-events-none absolute inset-x-0 bottom-6 flex justify-center">
        <Button
          variant="primary"
          size="lg"
          onClick={handleMarkReviewed}
          loading={marking}
          className="pointer-events-auto rounded-full px-6 shadow-lg shadow-indigo-600/25"
        >
          <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
          Mark as Reviewed
        </Button>
      </div>
    </div>
  )
}