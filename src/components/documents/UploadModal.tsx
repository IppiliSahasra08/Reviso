'use client'

import { useEffect, useRef, useState, type DragEvent } from 'react'
import { UploadCloud, X, AlertCircle } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { createClient } from '@/lib/supabase/client'
import { useUpload, validateFile, detectFileType } from '@/hooks/useUpload'
import { buildFolderTree, flattenFolderTree } from '@/lib/folders'
import { cn, fileTypeIcon, formatBytes } from '@/lib/utils'
import type { Folder } from '@/types/database'

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
  /** Pre-selects and locks the subject, e.g. when opened from a subject's folder page. */
  lockedSubjectId?: string
  /** Default folder selection within the (locked or chosen) subject. Still editable via the dropdown. */
  initialFolderId?: string | null
}

interface FieldErrors {
  file?: string
  title?: string
}

export function UploadModal({
  isOpen,
  onClose,
  onUploadComplete,
  lockedSubjectId,
  initialFolderId = null,
}: UploadModalProps) {
  const supabase = createClient()
  const { upload, cancel, reset, status, progress, error } = useUpload()

  const [subjects, setSubjects] = useState<SubjectOption[]>([])
  const [folders, setFolders] = useState<Folder[]>([])

  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [subjectId, setSubjectId] = useState(lockedSubjectId ?? '')
  const [folderId, setFolderId] = useState<string | null>(initialFolderId)
  const [dragActive, setDragActive] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

  const fileInputRef = useRef<HTMLInputElement>(null)
  const isBusy = status === 'uploading' || status === 'saving'

  // Load the user's subjects for the dropdown, unless the subject is locked.
  useEffect(() => {
    if (!isOpen || lockedSubjectId) return
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

  // Load the folder tree for whichever subject is currently selected.
  // Re-runs whenever the subject changes so the folder dropdown always
  // reflects the right subject's structure.
  useEffect(() => {
    if (!isOpen || !subjectId) {
      setFolders([])
      return
    }
    let cancelled = false

    async function loadFolders() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('folders')
        .select('*')
        .eq('subject_id', subjectId)
        .eq('user_id', user.id)

      if (!cancelled) setFolders(data ?? [])
    }

    loadFolders()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, subjectId])

  const folderOptions = flattenFolderTree(buildFolderTree(folders))

  function resetForm() {
    setFile(null)
    setTitle('')
    setSubjectId(lockedSubjectId ?? '')
    setFolderId(initialFolderId)
    setFieldErrors({})
    reset()
  }

  function handleClose() {
    if (isBusy) cancel()
    resetForm()
    onClose()
  }

  function handleSubjectChange(nextSubjectId: string) {
    setSubjectId(nextSubjectId)
    // A folder belongs to exactly one subject — switching subjects means
    // the previously selected folder no longer applies.
    setFolderId(null)
  }

  function selectFile(candidate: File) {
    const validationError = validateFile(candidate)
    if (validationError) {
      setFieldErrors((prev) => ({ ...prev, file: validationError }))
      setFile(null)
      return
    }

    setFieldErrors((prev) => ({ ...prev, file: undefined }))
    setFile(candidate)
    setTitle((prev) => prev || candidate.name.replace(/\.[^./\\]+$/, ''))
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
    const errors: FieldErrors = {}
    if (!file) errors.file = 'Choose a PDF, PPT, or PPTX file to upload.'
    if (!title.trim()) errors.title = 'Give the document a title.'

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }
    if (!file) return

    try {
      const documentId = await upload({
        file,
        title,
        subjectId: subjectId || null,
        folderId,
      })
      onUploadComplete?.(documentId)
      resetForm()
      onClose()
    } catch {
      // Error state is already surfaced via the hook's `error` value.
    }
  }

  const detectedType = file ? detectFileType(file) : null
  const FileIcon = fileTypeIcon(detectedType ?? 'pdf')

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Upload a document">
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
                : fieldErrors.file
                  ? 'border-red-300 bg-red-50'
                  : 'border-slate-200 bg-slate-50 hover:border-slate-300'
            )}
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-indigo-500 shadow-sm">
              <UploadCloud className="h-6 w-6" aria-hidden="true" />
            </span>
            <p className="text-sm font-medium text-slate-700">
              Drag and drop a file here, or{' '}
              <span className="text-indigo-600 underline">browse</span>
            </p>
            <p className="text-xs text-slate-400">
              PDF, PPT, or PPTX — up to {formatBytes(50 * 1024 * 1024)} for PDFs,{' '}
              {formatBytes(100 * 1024 * 1024)} for PPT/PPTX
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.ppt,.pptx,application/pdf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
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
              <FileIcon className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-900">{file.name}</p>
              <p className="text-xs text-slate-500">
                {formatBytes(file.size)}
                {detectedType && ` · ${detectedType.toUpperCase()}`}
              </p>
            </div>
            {!isBusy && (
              <button
                type="button"
                onClick={() => {
                  setFile(null)
                  setFieldErrors((prev) => ({ ...prev, file: undefined }))
                }}
                aria-label="Remove file"
                className="rounded-md p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>
        )}

        {fieldErrors.file && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{fieldErrors.file}</span>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        {/* Title, subject, folder — shown once a valid file is selected */}
        {file && (
          <>
            <Input
              label="Title"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value)
                if (fieldErrors.title) setFieldErrors((prev) => ({ ...prev, title: undefined }))
              }}
              placeholder="Document title"
              error={fieldErrors.title}
              disabled={isBusy}
            />

            {!lockedSubjectId && (
              <div className="flex flex-col gap-1.5">
                <label htmlFor="upload-subject" className="text-sm font-medium text-slate-700">
                  Subject
                </label>
                <select
                  id="upload-subject"
                  value={subjectId}
                  onChange={(e) => handleSubjectChange(e.target.value)}
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
            )}

            <div className="flex flex-col gap-1.5">
              <label htmlFor="upload-folder" className="text-sm font-medium text-slate-700">
                Folder
              </label>
              <select
                id="upload-folder"
                value={folderId ?? '__root__'}
                onChange={(e) =>
                  setFolderId(e.target.value === '__root__' ? null : e.target.value)
                }
                disabled={isBusy || !subjectId}
                className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="__root__">
                  {subjectId ? '— Top level (no folder) —' : 'Select a subject first'}
                </option>
                {folderOptions.map((f) => (
                  <option key={f.id} value={f.id}>
                    {'\u00A0\u00A0\u00A0\u00A0'.repeat(f.depth)}
                    {f.depth > 0 ? '\u21B3 ' : ''}
                    {f.title}
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
          <Button variant="primary" onClick={handleUpload} disabled={isBusy} loading={isBusy}>
            Upload
          </Button>
        </div>
      </div>
    </Modal>
  )
}