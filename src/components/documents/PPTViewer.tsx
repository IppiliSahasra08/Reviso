'use client'

import { useState } from 'react'
import { Download, Presentation, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import type { DocumentFileType } from '@/types/database'

export type PPTViewerMode = 'office-embed' | 'coming-soon'

export interface PPTViewerProps {
  /** Resolved, publicly-fetchable URL for the file (e.g. a Supabase signed URL). */
  fileUrl: string
  fileType: Extract<DocumentFileType, 'ppt' | 'pptx'>
  /**
   * 'office-embed' renders the file via Microsoft's Office Online viewer.
   * 'coming-soon' skips straight to the placeholder + download link.
   * Defaults to 'office-embed'.
   *
   * Note: Office Online's viewer fetches fileUrl itself from Microsoft's
   * servers, so it only works with a URL that's actually reachable from
   * the public internet — a signed Supabase Storage URL works, but a
   * localhost URL during local dev will not render.
   */
  mode?: PPTViewerMode
}

/** Embeds or gracefully degrades a PPT/PPTX preview. */
export function PPTViewer({ fileUrl, fileType, mode = 'office-embed' }: PPTViewerProps) {
  const [embedFailed, setEmbedFailed] = useState(false)
  const showEmbed = mode === 'office-embed' && !embedFailed

  const embedSrc = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(fileUrl)}`

  return (
    <div className="flex h-full flex-col bg-slate-100">
      {showEmbed ? (
        <>
          <iframe
            src={embedSrc}
            title="Presentation preview"
            className="h-full w-full flex-1 border-0"
            // Office Online has no reliable "load failed" event we can hook
            // into from the parent; onError only fires for network-level
            // failures on the iframe element itself.
            onError={() => setEmbedFailed(true)}
          />
          <div className="flex items-center justify-between gap-2 border-t border-slate-200 bg-white px-4 py-2 text-xs text-slate-500">
            <span>Previewing via Microsoft Office Online</span>
            <a
              href={fileUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 font-medium text-indigo-600 hover:text-indigo-700"
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              Download {fileType.toUpperCase()}
            </a>
          </div>
        </>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-16 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-indigo-500 shadow-sm">
            <Presentation className="h-7 w-7" aria-hidden="true" />
          </span>
          <p className="text-sm font-medium text-slate-700">
            {embedFailed ? 'Preview unavailable right now' : 'PPT viewing coming soon'}
          </p>
          <p className="max-w-sm text-sm text-slate-500">
            In-browser preview for {fileType.toUpperCase()} files isn&apos;t ready yet. Download
            the file to view it in PowerPoint or a compatible app.
          </p>
          <div className="mt-1 flex items-center gap-2">
            <Button variant="primary" size="sm" onClick={() => window.open(fileUrl, '_blank')}>
              <Download className="h-4 w-4" aria-hidden="true" />
              Download
            </Button>
            {mode === 'office-embed' && embedFailed && (
              <Button variant="outline" size="sm" onClick={() => setEmbedFailed(false)}>
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
                Try preview again
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}