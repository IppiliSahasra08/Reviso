'use client'

import { useEffect, useState } from 'react'
import { AlertCircle } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { PDFViewer } from './PDFViewer'
import { PPTViewer } from './PPTViewer'
import { createClient } from '@/lib/supabase/client'
import { STORAGE_BUCKET } from '@/hooks/useUpload'
import { fileTypeIcon } from '@/lib/utils'
import type { DocumentFileType } from '@/types/database'

const SIGNED_URL_TTL_SECONDS = 60 * 60 // 1 hour — long enough for a review session

export interface ViewerDocument {
  id: string
  title: string
  fileType: DocumentFileType
  /** Storage object path (documents.file_url), not a public URL. */
  filePath: string
  /** Known page/slide count from upload time; used as a fallback before the PDF reports its own count. */
  pageCount: number
}

export interface DocumentViewerProps {
  document: ViewerDocument
  /** Bubbles PDF page changes up, e.g. so a parent can log "pages read" on review. */
  onPageChange?: (page: number, totalPages: number) => void
}

export function DocumentViewer({ document, onPageChange }: DocumentViewerProps) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(document.pageCount || null)

  useEffect(() => {
    let cancelled = false
    setSignedUrl(null)
    setError(null)

    async function resolveUrl() {
      const supabase = createClient()
      const { data, error: signError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .createSignedUrl(document.filePath, SIGNED_URL_TTL_SECONDS)

      if (cancelled) return

      if (signError || !data) {
        setError(signError?.message ?? "Couldn't generate a link to this file.")
        return
      }
      setSignedUrl(data.signedUrl)
    }

    resolveUrl()
    return () => {
      cancelled = true
    }
  }, [document.filePath])

  function handlePdfPageInfoChange(page: number, total: number) {
    setCurrentPage(page)
    setTotalPages(total)
    onPageChange?.(page, total)
  }

  const FileIcon = fileTypeIcon(document.fileType)

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white">
      {/* Unified toolbar */}
      <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
          <FileIcon className="h-4 w-4" aria-hidden="true" />
        </span>
        <h2 className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900" title={document.title}>
          {document.title}
        </h2>
        <Badge variant="default">{document.fileType.toUpperCase()}</Badge>
        <span className="shrink-0 text-xs text-slate-500 tabular-nums">
          {document.fileType === 'pdf'
            ? totalPages
              ? `Page ${currentPage} of ${totalPages}`
              : 'Loading…'
            : totalPages
              ? `${totalPages} slides`
              : 'Slide deck'}
        </span>
      </div>

      {/* Viewer body */}
      <div className="min-h-0 flex-1">
        {error ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
            <AlertCircle className="h-6 w-6 text-red-500" aria-hidden="true" />
            <p className="text-sm font-medium text-red-700">Couldn&apos;t open this document</p>
            <p className="text-sm text-red-600">{error}</p>
            <Button variant="outline" size="sm" className="mt-2" onClick={() => setError(null)}>
              Try again
            </Button>
          </div>
        ) : !signedUrl ? (
          <div className="flex h-full items-center justify-center">
            <div className="h-[70vh] w-[54vh] max-w-full animate-pulse rounded bg-slate-100" />
          </div>
        ) : document.fileType === 'pdf' ? (
          <PDFViewer
            fileUrl={signedUrl}
            initialPage={currentPage}
            onPageInfoChange={handlePdfPageInfoChange}
          />
        ) : (
          <PPTViewer fileUrl={signedUrl} fileType={document.fileType} />
        )}
      </div>
    </div>
  )
}