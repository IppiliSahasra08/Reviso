'use client'

import { useEffect, useRef, useState } from 'react'
import { MoreVertical, Trash2, FileText } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { cn, formatDate, stageNames } from '@/lib/utils'

const TOTAL_STAGES = stageNames.length - 1 // 6 review stages (index 0 is "new")

export interface DocumentCardData {
  title: string
  subject: {
    name: string
    color: string
  }
  /** 0 = not yet started, 1-6 map to stageNames. */
  currentStage: number
  nextReviewDate: string
  lastReviewedAt?: string | null
  uploadedAt: string
}

export interface DocumentCardProps {
  document: DocumentCardData
  onOpen: () => void
  onDelete: () => void
}

function isDue(nextReviewDate: string): boolean {
  const next = new Date(nextReviewDate)
  if (Number.isNaN(next.getTime())) return false

  const today = new Date()
  today.setHours(23, 59, 59, 999) // treat "today" as due through end of day

  return next.getTime() <= today.getTime()
}

export function DocumentCard({ document, onOpen, onDelete }: DocumentCardProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const due = isDue(document.nextReviewDate)

  useEffect(() => {
    if (!menuOpen) return

    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setMenuOpen(false)
    }

    // Using `window` here (not `document`) because the `document` identifier
    // in this file refers to the component's `document` prop, not the DOM.
    window.addEventListener('mousedown', handleClickOutside)
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('mousedown', handleClickOutside)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [menuOpen])

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen()
        }
      }}
      className={cn(
        'group relative flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4',
        'cursor-pointer shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500'
      )}
    >
      {/* Top row: icon, title, menu */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2.5">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-500">
            <FileText className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-slate-900" title={document.title}>
              {document.title}
            </h3>
            <div className="mt-1 flex items-center gap-1.5">
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: document.subject.color }}
                aria-hidden="true"
              />
              <span className="truncate text-xs text-slate-500">{document.subject.name}</span>
            </div>
          </div>
        </div>

        <div ref={menuRef} className="relative shrink-0">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setMenuOpen((v) => !v)
            }}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label="Document options"
            className="rounded-md p-1.5 text-slate-400 opacity-0 transition-opacity hover:bg-slate-100 hover:text-slate-600 focus:opacity-100 focus-visible:ring-2 focus-visible:ring-indigo-500 group-hover:opacity-100 data-[open=true]:opacity-100"
            data-open={menuOpen}
          >
            <MoreVertical className="h-4 w-4" aria-hidden="true" />
          </button>

          {menuOpen && (
            <div
              role="menu"
              onClick={(e) => e.stopPropagation()}
              className="absolute right-0 z-20 mt-1 w-40 rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false)
                  onDelete()
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                Delete
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Stage progress */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-500">
            {document.currentStage > 0 ? stageNames[document.currentStage] : 'Not started'}
          </span>
          <span className="text-xs text-slate-400">
            {document.currentStage}/{TOTAL_STAGES}
          </span>
        </div>
        <div className="flex gap-1">
          {Array.from({ length: TOTAL_STAGES }).map((_, i) => (
            <span
              key={i}
              className={cn(
                'h-1.5 flex-1 rounded-full',
                i < document.currentStage ? 'bg-indigo-500' : 'bg-slate-100'
              )}
            />
          ))}
        </div>
      </div>

      {/* Footer: due badge + dates */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <div className="flex items-center gap-2">
          {due && <Badge variant="warning">Due</Badge>}
          <span className="text-xs text-slate-400">
            {document.lastReviewedAt
              ? `Reviewed ${formatDate(document.lastReviewedAt, { relative: true })}`
              : `Added ${formatDate(document.uploadedAt, { relative: true })}`}
          </span>
        </div>
      </div>
    </div>
  )
}