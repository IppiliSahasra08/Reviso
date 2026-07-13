'use client'

import { useCallback, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { DocumentInsert } from '@/types/database'

export const STORAGE_BUCKET = 'documents'
export const MAX_PDF_SIZE_BYTES = 50 * 1024 * 1024 // 50MB
export const MAX_PPT_SIZE_BYTES = 100 * 1024 * 1024 // 100MB
/** @deprecated kept for backwards compatibility with any existing imports */
export const MAX_FILE_SIZE_BYTES = MAX_PDF_SIZE_BYTES

export type UploadStatus =
  | 'idle'
  | 'uploading' // file bytes going to Supabase Storage
  | 'saving' // inserting the document row
  | 'success'
  | 'error'

export interface UploadInput {
  file: File
  title: string
  subjectId: string | null
  folderId?: string | null
}

/**
 * Detects the document file type based on file name extension.
 */
export function detectFileType(file: File): 'pdf' | 'ppt' | 'pptx' {
  const extension = file.name.split('.').pop()?.toLowerCase()
  if (extension === 'ppt') return 'ppt'
  if (extension === 'pptx') return 'pptx'
  return 'pdf'
}

/**
 * Validates a file for PDF, PPT, or PPTX uploads, with a larger size cap
 * for PPT/PPTX (they tend to run bigger due to embedded media).
 * Returns an error message, or null if the file is valid.
 */
export function validateFile(file: File): string | null {
  const type = detectFileType(file)

  const isKnownType =
    type === 'pdf' ||
    file.type === 'application/vnd.ms-powerpoint' ||
    file.type ===
    'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
    file.name.toLowerCase().endsWith('.ppt') ||
    file.name.toLowerCase().endsWith('.pptx')

  if (!isKnownType) {
    return 'Only PDF, PPT, or PPTX files are supported.'
  }

  if (file.size === 0) {
    return 'This file appears to be empty.'
  }

  if (type === 'pdf') {
    if (file.size > MAX_PDF_SIZE_BYTES) {
      return 'File is too large. Maximum size is 50MB for PDFs.'
    }
  } else {
    if (file.size > MAX_PPT_SIZE_BYTES) {
      return 'File is too large. Maximum size is 100MB for PPT/PPTX.'
    }
  }

  return null
}

/**
 * Reads a PDF's page count client-side using pdf-lib.
 * Requires `npm install pdf-lib`. Falls back to 0 if parsing fails
 * (a corrupt or unusually-encoded PDF shouldn't block the upload).
 */
async function getPageCount(file: File): Promise<number> {
  try {
    const { PDFDocument } = await import('pdf-lib')
    const buffer = await file.arrayBuffer()
    const pdf = await PDFDocument.load(buffer, {
      updateMetadata: false,
      ignoreEncryption: true,
    })
    return pdf.getPageCount()
  } catch {
    return 0
  }
}

/**
 * Uploads a file to a Supabase Storage signed URL via XMLHttpRequest so we
 * can report real upload progress — the standard `storage.upload()` call in
 * supabase-js does not expose progress events.
 */
function uploadWithProgress(
  signedUrl: string,
  file: File,
  fileType: 'pdf' | 'ppt' | 'pptx',
  onProgress: (percent: number) => void,
  registerAbort: (abort: () => void) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', signedUrl)
    const fallbackContentType =
      fileType === 'pdf'
        ? 'application/pdf'
        : fileType === 'pptx'
          ? 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
          : 'application/vnd.ms-powerpoint'
    xhr.setRequestHeader('Content-Type', file.type || fallbackContentType)
    xhr.setRequestHeader('x-upsert', 'false')

    registerAbort(() => xhr.abort())

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100))
      }
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve()
      } else {
        reject(new Error(`Upload failed (${xhr.status}).`))
      }
    }

    xhr.onerror = () => reject(new Error('Network error during upload.'))
    xhr.onabort = () => reject(new Error('Upload cancelled.'))

    xhr.send(file)
  })
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9.\-_]/g, '_')
}

export function useUpload() {
  const supabase = createClient()

  const [status, setStatus] = useState<UploadStatus>('idle')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<(() => void) | null>(null)

  const reset = useCallback(() => {
    setStatus('idle')
    setProgress(0)
    setError(null)
    abortRef.current = null
  }, [])

  const upload = useCallback(
    async ({ file, title, subjectId, folderId }: UploadInput): Promise<string> => {
      setError(null)
      setProgress(0)

      const validationError = validateFile(file)
      if (validationError) {
        setStatus('error')
        setError(validationError)
        throw new Error(validationError)
      }

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
          throw new Error('You must be signed in to upload a document.')
        }

        setStatus('uploading')

        const path = `${user.id}/${crypto.randomUUID()}-${sanitizeFilename(file.name)}`
        const fileType = detectFileType(file)

        // 1. Get a signed upload URL (needed to track progress via XHR).
        const { data: signedData, error: signedError } = await supabase.storage
          .from(STORAGE_BUCKET)
          .createSignedUploadUrl(path)

        if (signedError || !signedData) {
          throw new Error(signedError?.message ?? 'Could not start the upload.')
        }

        // 2. Upload the raw bytes with real progress reporting.
        await uploadWithProgress(signedData.signedUrl, file, fileType, setProgress, (abort) => {
          abortRef.current = abort
        })

        // 3. Best-effort page count for PDFs only (non-blocking if it fails).
        const pageCount = fileType === 'pdf' ? await getPageCount(file) : 0

        setStatus('saving')

        const now = new Date().toISOString()
        const insertPayload: any = {
          user_id: user.id,
          subject_id: subjectId,
          folder_id: folderId || null,
          title: title.trim() || file.name.replace(/\.(pdf|ppt|pptx)$/i, ''),
          file_type: fileType,
          file_url: path,
          file_size: file.size,
          page_count: pageCount,
          current_page: 0,
          current_stage: 0,
          next_review_date: now,
          uploaded_at: now,
        }

        const { data: inserted, error: insertError } = await (supabase
          .from('documents') as any)
          .insert(insertPayload)
          .select('id')
          .single()

        if (insertError || !inserted) {
          // Clean up the orphaned storage object if the row insert failed.
          await supabase.storage.from(STORAGE_BUCKET).remove([path])
          throw new Error(insertError?.message ?? 'Could not save the document.')
        }

        setStatus('success')
        setProgress(100)
        return inserted.id as string
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Upload failed.'
        setStatus('error')
        setError(message)
        throw err instanceof Error ? err : new Error(message)
      } finally {
        abortRef.current = null
      }
    },
    [supabase]
  )

  const cancel = useCallback(() => {
    abortRef.current?.()
  }, [])

  return { upload, cancel, reset, status, progress, error }
}