'use client'

import { useEffect, useRef, useState } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Maximize,
  StretchHorizontal,
  AlertCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

// Loaded from a CDN rather than bundled — avoids Next.js/webpack worker
// bundling quirks and stays in sync with whatever pdfjs-dist react-pdf ships.
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

const MIN_SCALE = 0.5
const MAX_SCALE = 3
const SCALE_STEP = 0.15
// Approximate US-Letter/A4 aspect ratio, used for the "fit page" estimate
// before react-pdf has actually reported the page's real dimensions.
const DEFAULT_PAGE_ASPECT = 1.294

type FitMode = 'custom' | 'width' | 'page'

export interface PDFViewerProps {
  /** Resolved, fetchable URL for the PDF (e.g. a Supabase signed URL). */
  fileUrl: string
  /** Page to open on. Defaults to 1. */
  initialPage?: number
  /** Reports the current page and total page count up to a parent toolbar. */
  onPageInfoChange?: (page: number, totalPages: number) => void
}

export function PDFViewer({ fileUrl, initialPage = 1, onPageInfoChange }: PDFViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  const [numPages, setNumPages] = useState<number | null>(null)
  const [pageNumber, setPageNumber] = useState(initialPage)
  const [pageInput, setPageInput] = useState(String(initialPage))
  const [scale, setScale] = useState(1)
  const [fitMode, setFitMode] = useState<FitMode>('width')
  const [containerWidth, setContainerWidth] = useState(0)
  const [containerHeight, setContainerHeight] = useState(0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      setContainerWidth(entry.contentRect.width)
      setContainerHeight(entry.contentRect.height)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    setPageInput(String(pageNumber))
    if (numPages) onPageInfoChange?.(pageNumber, numPages)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageNumber, numPages])

  function goToPage(next: number) {
    if (!numPages) return
    setPageNumber(Math.min(Math.max(next, 1), numPages))
  }

  function handlePageInputSubmit() {
    const parsed = Number(pageInput)
    if (Number.isFinite(parsed)) goToPage(Math.trunc(parsed))
    else setPageInput(String(pageNumber))
  }

  function zoom(delta: number) {
    setFitMode('custom')
    setScale((prev) => Math.min(Math.max(prev + delta, MIN_SCALE), MAX_SCALE))
  }

  // Effective width passed to <Page>: drives both "fit width" and
  // "fit page" (page height estimated via DEFAULT_PAGE_ASPECT until the
  // real page loads). Custom zoom uses `scale` against the page's native size instead.
  let pageWidth: number | undefined
  if (fitMode === 'width') {
    pageWidth = containerWidth || undefined
  } else if (fitMode === 'page') {
    const widthForHeight = containerHeight ? containerHeight / DEFAULT_PAGE_ASPECT : undefined
    pageWidth = widthForHeight ? Math.min(widthForHeight, containerWidth || Infinity) : undefined
  }

  return (
    <div className="flex h-full flex-col">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-3 py-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => goToPage(pageNumber - 1)}
            disabled={pageNumber <= 1}
            aria-label="Previous page"
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 disabled:pointer-events-none disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>
          <div className="flex items-center gap-1 text-sm text-slate-600">
            <input
              type="text"
              inputMode="numeric"
              value={pageInput}
              onChange={(e) => setPageInput(e.target.value)}
              onBlur={handlePageInputSubmit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handlePageInputSubmit()
                }
              }}
              className="h-7 w-10 rounded border border-slate-200 text-center text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              aria-label="Page number"
            />
            <span>/ {numPages ?? '–'}</span>
          </div>
          <button
            type="button"
            onClick={() => goToPage(pageNumber + 1)}
            disabled={!numPages || pageNumber >= numPages}
            aria-label="Next page"
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 disabled:pointer-events-none disabled:opacity-40"
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={() => zoom(-SCALE_STEP)}
            disabled={fitMode === 'custom' && scale <= MIN_SCALE}
            aria-label="Zoom out"
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 disabled:pointer-events-none disabled:opacity-40"
          >
            <ZoomOut className="h-4 w-4" aria-hidden="true" />
          </button>
          <span className="w-10 text-center text-xs text-slate-500 tabular-nums">
            {fitMode === 'custom' ? `${Math.round(scale * 100)}%` : fitMode === 'width' ? 'Width' : 'Page'}
          </span>
          <button
            type="button"
            onClick={() => zoom(SCALE_STEP)}
            disabled={fitMode === 'custom' && scale >= MAX_SCALE}
            aria-label="Zoom in"
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 disabled:pointer-events-none disabled:opacity-40"
          >
            <ZoomIn className="h-4 w-4" aria-hidden="true" />
          </button>

          <div className="mx-1 h-5 w-px bg-slate-200" aria-hidden="true" />

          <button
            type="button"
            onClick={() => setFitMode('width')}
            aria-pressed={fitMode === 'width'}
            aria-label="Fit width"
            title="Fit width"
            className={cn(
              'rounded-md p-1.5 hover:bg-slate-100',
              fitMode === 'width' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-500'
            )}
          >
            <StretchHorizontal className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => setFitMode('page')}
            aria-pressed={fitMode === 'page'}
            aria-label="Fit page"
            title="Fit page"
            className={cn(
              'rounded-md p-1.5 hover:bg-slate-100',
              fitMode === 'page' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-500'
            )}
          >
            <Maximize className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div ref={containerRef} className="flex flex-1 justify-center overflow-auto bg-slate-100 p-4">
        {error ? (
          <div className="flex h-fit flex-col items-center gap-2 self-center rounded-xl border border-red-200 bg-red-50 px-6 py-10 text-center">
            <AlertCircle className="h-6 w-6 text-red-500" aria-hidden="true" />
            <p className="text-sm font-medium text-red-700">Couldn&apos;t load this PDF</p>
            <p className="text-sm text-red-600">{error}</p>
          </div>
        ) : (
          <Document
            file={fileUrl}
            onLoadSuccess={({ numPages: total }) => {
              setNumPages(total)
              setPageNumber((prev) => Math.min(prev, total))
            }}
            onLoadError={(err) => setError(err.message || 'The file could not be parsed.')}
            loading={<PageSkeleton />}
            error={null}
          >
            <Page
              pageNumber={pageNumber}
              width={pageWidth}
              scale={fitMode === 'custom' ? scale : undefined}
              loading={<PageSkeleton />}
              className="shadow-md"
            />
          </Document>
        )}
      </div>
    </div>
  )
}

function PageSkeleton() {
  return <div className="h-[70vh] w-[54vh] max-w-full animate-pulse rounded bg-slate-200" />
}