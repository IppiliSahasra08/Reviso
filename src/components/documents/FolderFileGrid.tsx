'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FileText, Inbox } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { DocumentCard, type DocumentCardData } from '@/components/documents/DocumentCard'
import { Button } from '@/components/ui/Button'

interface DocumentRow {
  id: string
  title: string
  file_type: 'pdf' | 'ppt' | 'pptx'
  current_stage: number
  next_review_date: string
  last_reviewed_at: string | null
  uploaded_at: string
  subjects: { name: string; color: string } | null
}

export interface FolderFileGridProps {
  subjectId: string
  /** null means "documents filed directly under the subject, not in any folder". */
  folderId: string | null
  activeFolderTitle: string
  onUploadClick?: () => void
}

/**
 * Right-pane grid: documents scoped to one folder (or the subject root when
 * folderId is null). Mirrors DocumentGrid's loading/empty/error states but
 * filters by folder_id instead of exposing search/sort controls — this is
 * meant to be a focused view of "what's in this folder".
 */
export function FolderFileGrid({
  subjectId,
  folderId,
  activeFolderTitle,
  onUploadClick,
}: FolderFileGridProps) {
  const router = useRouter()
  const supabase = createClient()

  const [documents, setDocuments] = useState<(DocumentRow & { id: string })[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
        'id, title, file_type, current_stage, next_review_date, last_reviewed_at, uploaded_at, subjects(name, color)'
      )
      .eq('user_id', user.id)
      .eq('subject_id', subjectId)
      .is('deleted_at', null)
      .order('title', { ascending: true })

    query = folderId ? query.eq('folder_id', folderId) : query.is('folder_id', null)

    const { data, error: fetchError } = await query

    if (fetchError) {
      setError(fetchError.message)
      setDocuments([])
    } else {
      setDocuments((data ?? []) as unknown as (DocumentRow & { id: string })[])
    }

    setLoading(false)
  }, [supabase, subjectId, folderId])

  useEffect(() => {
    fetchDocuments()
  }, [fetchDocuments])

  async function handleDelete(id: string) {
    setDocuments((prev) => prev.filter((doc) => doc.id !== id))

    const { error: deleteError } = await (supabase
      .from('documents') as any)
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)

    if (deleteError) fetchDocuments()
  }

  const cards: DocumentCardData[] = documents.map((doc) => ({
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
  }))

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
          </div>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-5 py-10 text-center">
        <p className="text-sm font-medium text-red-700">Couldn&apos;t load files</p>
        <p className="text-sm text-red-600">{error}</p>
        <Button variant="outline" size="sm" onClick={fetchDocuments} className="mt-2">
          Try again
        </Button>
      </div>
    )
  }

  if (cards.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-200 bg-white px-5 py-16 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
          <Inbox className="h-6 w-6" aria-hidden="true" />
        </span>
        <p className="text-sm font-medium text-slate-700">{activeFolderTitle} is empty</p>
        <p className="text-sm text-slate-500">Upload a document to get started.</p>
        {onUploadClick && (
          <Button variant="primary" size="sm" className="mt-2" onClick={onUploadClick}>
            <FileText className="h-4 w-4" aria-hidden="true" />
            Upload Document
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {documents.map((doc, i) => (
        <DocumentCard
          key={doc.id}
          document={cards[i]}
          onOpen={() => router.push(`/documents/${doc.id}`)}
          onDelete={() => handleDelete(doc.id)}
        />
      ))}
    </div>
  )
}