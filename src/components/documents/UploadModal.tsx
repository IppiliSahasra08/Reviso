'use client'

import { useEffect, useRef, useState, type DragEvent } from 'react'
import { UploadCloud, X, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
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
  /** Called once per file, with that document's id, as each upload succeeds. */
  onUploadComplete?: (documentId: string) => void
  /** Pre-selects and locks the subject, e.g. when opened from a subject's folder page. */
  lockedSubjectId?: string
  /** Default folder selection within the (locked or chosen) subject. Still editable via the dropdown. */
  initialFolderId?: string | null
}

type ItemStatus = 'pending' | 'uploading' | 'saving' | 'success' | 'error'

interface UploadItem {
  key: string
  file: File
  title: string
  status: ItemStatus
  progress: number
  error?: string
}

function makeItem(file: File): UploadItem {
  const validationError = validateFile(file)
  return {
    key: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
    file,
    title: file.name.replace(/\.(pdf|ppt|pptx)$/i, ''),
    status: validationError ? 'error' : 'pending',
    progress: 0,
    error: validationError ?? undefined,
  }
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

  const [items, setItems] = useState<UploadItem[]>([])
  const [subjectId, setSubjectId] = useState(lockedSubjectId ?? '')
  const [folderId, setFolderId] = useState<string | null>(initialFolderId)
  const [dragActive, setDragActive] = useState(false)
  const [isBatchRunning, setIsBatchRunning] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const currentKeyRef = useRef<string | null>(null)
  const isBusy = isBatchRunning || status === 'uploading' || status === 'saving'

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

  // Mirror the single-file upload hook's live progress onto whichever item
  // is currently uploading. The hook itself only tracks one file at a time;
  // we drive it sequentially across the batch from handleUploadAll below.
  useEffect(() => {
    const key = currentKeyRef.current
    if (!key) return
    if (status === 'uploading' || status === 'saving') {
      setItems((prev) =>
        prev.map((it) => (it.key === key ? { ...it, status, progress } : it))
      )
    }
  }, [status, progress])

  const folderOptions = flattenFolderTree(buildFolderTree(folders))

  function resetForm() {
    setItems([])
    setSubjectId(lockedSubjectId ?? '')
    setFolderId(initialFolderId)
    setIsBatchRunning(false)
    currentKeyRef.current = null
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

  function addFiles(fileList: FileList | File[]) {
    const incoming = Array.from(fileList).map(makeItem)
    if (incoming.length === 0) return
    setItems((prev) => [...prev, ...incoming])
  }

  function removeItem(key: string) {
    if (isBusy) return
    setItems((prev) => prev.filter((it) => it.key !== key))
  }

  function updateItemTitle(key: string, title: string) {
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, title } : it)))
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setDragActive(false)
    if (isBusy) return
    if (event.dataTransfer.files?.length) addFiles(event.dataTransfer.files)
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    if (!isBusy) setDragActive(true)
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setDragActive(false)
  }

  async function handleUploadAll() {
    const pending = items.filter((it) => it.status === 'pending' || it.status === 'error')
    if (pending.length === 0) return

    setIsBatchRunning(true)

    for (const item of pending) {
      currentKeyRef.current = item.key
      reset()
      setItems((prev) =>
        prev.map((it) =>
          it.key === item.key ? { ...it, status: 'uploading', progress: 0, error: undefined } : it
        )
      )

      try {
        const documentId = await upload({
          file: item.file,
          title: item.title,
          subjectId: subjectId || null,
          folderId,
        })
        setItems((prev) =>
          prev.map((it) => (it.key === item.key ? { ...it, status: 'success', progress: 100 } : it))
        )
        onUploadComplete?.(documentId)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Upload failed.'
        setItems((prev) =>
          prev.map((it) => (it.key === item.key ? { ...it, status: 'error', error: message } : it))
        )
      }
    }

    currentKeyRef.current = null
    setIsBatchRunning(false)

    // If every item made it through successfully, close automatically.
    setItems((prev) => {
      const allDone = prev.every((it) => it.status === 'success')
      if (allDone) {
        // Defer close slightly so the 100% state is visible for a beat.
        setTimeout(() => {
          resetForm()
          onClose()
        }, 400)
      }
      return prev
    })
  }

  const hasUploadableItems = items.some((it) => it.status === 'pending' || it.status === 'error')
  const allSucceeded = items.length > 0 && items.every((it) => it.status === 'success')

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Upload documents">
      <div className="flex flex-col gap-4">
        {/* Drag-and-drop zone / file browser — always visible so more files can be added */}
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => !isBusy && fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          className={cn(
            'flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors',
            dragActive ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 bg-slate-50 hover:border-slate-300',
            isBusy && 'pointer-events-none opacity-60'
          )}
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-indigo-500 shadow-sm">
            <UploadCloud className="h-5 w-5" aria-hidden="true" />
          </span>
          <p className="text-sm font-medium text-slate-700">
            Drag and drop files here, or <span className="text-indigo-600 underline">browse</span>
          </p>
          <p className="text-xs text-slate-400">
            PDF, PPT, or PPTX — up to {formatBytes(50 * 1024 * 1024)} for PDFs,{' '}
            {formatBytes(100 * 1024 * 1024)} for PPT/PPTX. Select as many as you like.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.ppt,.pptx,application/pdf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) addFiles(e.target.files)
              e.target.value = ''
            }}
          />
        </div>

        {/* File list */}
        {items.length > 0 && (
          <div className="flex max-h-64 flex-col gap-2 overflow-y-auto">
            {items.map((item) => {
              const detectedType = detectFileType(item.file)
              const FileIcon = fileTypeIcon(detectedType)
              return (
                <div
                  key={item.key}
                  className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-indigo-500">
                      {item.status === 'success' ? (
                        <CheckCircle2 className="h-5 w-5 text-green-600" aria-hidden="true" />
                      ) : item.status === 'uploading' || item.status === 'saving' ? (
                        <Loader2 className="h-5 w-5 animate-spin text-indigo-500" aria-hidden="true" />
                      ) : (
                        <FileIcon className="h-5 w-5" aria-hidden="true" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <input
                        value={item.title}
                        onChange={(e) => updateItemTitle(item.key, e.target.value)}
                        disabled={isBusy || item.status === 'success'}
                        className="w-full truncate border-none bg-transparent p-0 text-sm font-medium text-slate-900 focus:outline-none focus:ring-0 disabled:opacity-70"
                      />
                      <p className="text-xs text-slate-500">
                        {formatBytes(item.file.size)} · {detectedType.toUpperCase()}
                      </p>
                    </div>
                    {item.status !== 'success' && !isBusy && (
                      <button
                        type="button"
                        onClick={() => removeItem(item.key)}
                        aria-label={`Remove ${item.file.name}`}
                        className="shrink-0 rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                      >
                        <X className="h-4 w-4" aria-hidden="true" />
                      </button>
                    )}
                  </div>

                  {(item.status === 'uploading' || item.status === 'saving') && (
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-indigo-600 transition-all duration-150"
                        style={{ width: `${item.status === 'saving' ? 100 : item.progress}%` }}
                      />
                    </div>
                  )}

                  {item.status === 'error' && item.error && (
                    <div className="flex items-start gap-1.5 text-xs text-red-600">
                      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      <span>{item.error}</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        {/* Subject / folder — shared across the whole batch */}
        {items.length > 0 && (
          <>
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
                onChange={(e) => setFolderId(e.target.value === '__root__' ? null : e.target.value)}
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

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={handleClose} disabled={isBusy}>
            {allSucceeded ? 'Done' : 'Cancel'}
          </Button>
          <Button
            variant="primary"
            onClick={handleUploadAll}
            disabled={isBusy || !hasUploadableItems}
            loading={isBusy}
          >
            {items.length > 1
              ? `Upload ${items.filter((it) => it.status === 'pending' || it.status === 'error').length} files`
              : 'Upload'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}