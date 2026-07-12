'use client'

import { useCallback, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatBytes } from '@/lib/utils'
import type { DocumentFileType, DocumentInsert } from '@/types/database'

export const STORAGE_BUCKET = 'documents'

// PPTs commonly embed images/video and run larger than a typical PDF, so
// they get a higher ceiling.
export const MAX_PDF_SIZE_BYTES = 50 * 1024 * 1024 // 50MB
export const MAX_PPT_SIZE_BYTES = 100 * 1024 * 1024 // 100MB

const MIME_TYPE_MAP: Record<string, DocumentFileType> = {
  'application/pdf': 'pdf',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
}

const EXTENSION_MAP: Record<string, DocumentFileType> = {
  pdf: 'pdf',
  ppt: 'ppt',
  pptx: 'pptx',
}

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
  /** Optional folder within subjectId. Omit/null files it at the subject root. */
  folderId?: string | null
}

/**
 * Detects a document's file type from its extension, falling back to MIME
 * type (some browsers/OSes report generic or missing MIME types for
 * PPT/PPTX, so extension is checked first). Returns null if the file isn't
 * one of the supported types.
 */
export function detectFileType(file: File): DocumentFileType | null {
  const extension = file.name.toLowerCase().split('.').pop()
  if (extension && extension in EXTENSION_MAP) {
    return EXTENSION_MAP[extension]
  }
  return MIME_TYPE_MAP[file.type] ?? null
}

function maxSizeFor(fileType: DocumentFileType): number {
  return fileType === 'pdf' ? MAX_PDF_SIZE_BYTES : MAX_PPT_SIZE_BYTES
}

/**
 * Validates a file for supported type (PDF/PPT/PPTX) and a type-specific
 * size cap. Returns an error message, or null if the file is valid.
 */
export function validateFile(file: File): string | null {
  const fileType = detectFileType(file)

  if (!fileType) {
    return 'Only PDF, PPT, and PPTX files are supported.'
  }
  if (file.size === 0) {
    return 'This file appears to be empty.'
  }

  const maxSize = maxSizeFor(fileType)
  if (file.size > maxSize) {
    return `File is too large. Maximum size for ${fileType.toUpperCase()} is ${formatBytes(maxSize)}.`
  }

  return null
}

/**
 * Reads a PDF's page count client-side using pdf-lib.
 * Requires `npm install pdf-lib`. Falls back to 0 if parsing fails
 * (a corrupt or unusually-encoded PDF shouldn't block the upload).
 * PPT/PPTX slide counts aren't parsed client-side yet — that needs a zip
 * reader (e.g. JSZip) to inspect the slide XML, which isn't wired up here.
 */
async function getPageCount(file: File, fileType: DocumentFileType): Promise<number> {
  if (fileType !== 'pdf') return 0

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
  onProgress: (percent: number) => void,
  registerAbort: (abort: () => void) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', signedUrl)
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream')
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

function stripExtension(filename: string): string {
  return filename.replace(/\.[^./\\]+$/, '')
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

  /**
   * Uploads a document (PDF, PPT, or PPTX) to Supabase Storage and creates
   * its `documents` row. File type is detected from the file itself, not
   * passed in — the caller doesn't need to know it ahead of time.
   */
  const upload = useCallback(
    async ({ file, title, subjectId, folderId = null }: UploadInput): Promise<string> => {
      setError(null)
      setProgress(0)

      const validationError = validateFile(file)
      if (validationError) {
        setStatus('error')
        setError(validationError)
        throw new Error(validationError)
      }

      // Safe: validateFile already confirmed this resolves to a supported type.
      const fileType = detectFileType(file)!

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
          throw new Error('You must be signed in to upload a document.')
        }

        setStatus('uploading')

        const path = `${user.id}/${crypto.randomUUID()}-${sanitizeFilename(file.name)}`

        // 1. Get a signed upload URL (needed to track progress via XHR).
        const { data: signedData, error: signedError } = await supabase.storage
          .from(STORAGE_BUCKET)
          .createSignedUploadUrl(path)

        if (signedError || !signedData) {
          throw new Error(signedError?.message ?? 'Could not start the upload.')
        }

        // 2. Upload the raw bytes with real progress reporting.
        await uploadWithProgress(signedData.signedUrl, file, setProgress, (abort) => {
          abortRef.current = abort
        })

        // 3. Best-effort page/slide count (non-blocking if it fails).
        const pageCount = await getPageCount(file, fileType)

        setStatus('saving')

        const now = new Date().toISOString()
        const insertPayload: DocumentInsert = {
          user_id: user.id,
          subject_id: subjectId,
          folder_id: folderId,
          file_type: fileType,
          title: title.trim() || stripExtension(file.name),
          file_url: path,
          file_size: file.size,
          page_count: pageCount,
          current_page: 0,
          current_stage: 0,
          next_review_date: now,
          uploaded_at: now,
        }

        const { data: inserted, error: insertError } = await supabase
          .from('documents')
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