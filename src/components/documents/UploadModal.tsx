'use client'

import { useEffect, useRef, useState, type DragEvent } from 'react'
import { UploadCloud, FileText, X, AlertCircle } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { createClient } from '@/lib/supabase/client'
import { useUpload, validateFile } from '@/hooks/useUpload'
import { cn, formatBytes } from '@/lib/utils'

interface SubjectOption {
  id: string
  name: string
  color: string
}

export interface UploadModalProps {
  isOpen: boolean
  onClose: () => void
  /** Called with the new document's id once the upload + insert succeed. */
  onUploadComplete?: (documentId: string) => void
}

export function UploadModal({ isOpen, onClose, onUploadComplete }: UploadModalProps) {
  const supabase = createClient()
  const { upload, cancel, reset, status, progress, error } = useUpload()

  const [subjects, setSubjects] = useState<SubjectOption[]>([])
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [subjectId, setSubjectId] = useState('')
  const [dragActive, setDragActive] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const isBusy = status === 'uploading' || status === 'saving'

  // Load the user's subjects for the dropdown whenever the modal opens.
  useEffect(() => {
    if (!isOpen) return
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
  }, [isOpen])

  function resetForm() {
    setFile(null)
    setTitle('')
    setSubjectId('')
    setLocalError(null)
    reset()
  }

  function handleClose() {
    if (isBusy) cancel()
    resetForm()
    onClose()
  }

  function selectFile(candidate: File) {
    const validationError = validateFile(candidate)
    if (validationError) {
      setLocalError(validationError)
      setFile(null)
      return
    }

    setLocalError(null)
    setFile(candidate)
    setTitle((prev) => prev || candidate.name.replace(/\.pdf$/i, ''))
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setDragActive(false)
    if (isBusy) return

    const dropped = event.dataTransfer.files?.[0]
    if (dropped) selectFile(dropped)
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    if (!isBusy) setDragActive(true)
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setDragActive(false)
  }

  async function handleUpload() {
    if (!file) return

    try {
      const documentId = await upload({
        file,
        title,
        subjectId: subjectId || null,
      })
      onUploadComplete?.(documentId)
      resetForm()
      onClose()
    } catch {
      // Error state is already surfaced via the hook's `error` value.
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Upload a PDF">
      <div className="flex flex-col gap-4">
        {/* Drag-and-drop zone / file browser fallback */}
        {!file ? (
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            className={cn(
              'flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors',
              dragActive
                ? 'border-indigo-400 bg-indigo-50'
                : 'border-slate-200 bg-slate-50 hover:border-slate-300'
            )}
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-indigo-500 shadow-sm">
              <UploadCloud className="h-6 w-6" aria-hidden="true" />
            </span>
            <p className="text-sm font-medium text-slate-700">
              Drag and drop a PDF here, or{' '}
              <span className="text-indigo-600 underline">browse</span>
            </p>
            <p className="text-xs text-slate-400">PDF only, up to 50MB</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              onChange={(e) => {
                const selected = e.target.files?.[0]
                if (selected) selectFile(selected)
                e.target.value = ''
              }}
            />
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-indigo-500 shadow-sm">
              <FileText className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-900">{file.name}</p>
              <p className="text-xs text-slate-500">{formatBytes(file.size)}</p>
            </div>
            {!isBusy && (
              <button
                type="button"
                onClick={() => {
                  setFile(null)
                  setLocalError(null)
                }}
                aria-label="Remove file"
                className="rounded-md p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>
        )}

        {(localError || error) && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{localError ?? error}</span>
          </div>
        )}

        {/* Title + subject — shown once a valid file is selected */}
        {file && (
          <>
            <Input
              label="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Document title"
              disabled={isBusy}
            />

            <div className="flex flex-col gap-1.5">
              <label htmlFor="upload-subject" className="text-sm font-medium text-slate-700">
                Subject
              </label>
              <select
                id="upload-subject"
                value={subjectId}
                onChange={(e) => setSubjectId(e.target.value)}
                disabled={isBusy}
                className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">No subject</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}

        {/* Progress bar */}
        {isBusy && (
          <div className="flex flex-col gap-1.5">
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-indigo-600 transition-all duration-150"
                style={{ width: `${status === 'saving' ? 100 : progress}%` }}
              />
            </div>
            <p className="text-xs text-slate-500">
              {status === 'uploading' ? `Uploading… ${progress}%` : 'Saving document…'}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={handleClose} disabled={isBusy}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleUpload}
            disabled={!file || !!localError || isBusy}
            loading={isBusy}
          >
            Upload
          </Button>
        </div>
      </div>
    </Modal>
  )
}