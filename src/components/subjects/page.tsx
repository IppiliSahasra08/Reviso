'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Check, X, Trash2, AlertTriangle, Folder, FileText } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { SubjectModal, PRESET_COLORS } from '@/components/subjects/SubjectModal'
import { cn } from '@/lib/utils'
import type { Subject } from '@/types/database'

interface SubjectCardData extends Subject {
  folderCount: number
  documentCount: number
}

export default function SubjectsPage() {
  const router = useRouter()
  const supabase = createClient()

  const [subjects, setSubjects] = useState<SubjectCardData[]>([])
  const [loading, setLoading] = useState(true)

  const [modalOpen, setModalOpen] = useState(false)

  const [editingNameId, setEditingNameId] = useState<string | null>(null)
  const [draftName, setDraftName] = useState('')

  const [colorPickerId, setColorPickerId] = useState<string | null>(null)
  const colorPickerRef = useRef<HTMLDivElement>(null)

  const [deleteTarget, setDeleteTarget] = useState<SubjectCardData | null>(null)
  const [deleting, setDeleting] = useState(false)

  async function fetchSubjects() {
    setLoading(true)

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      return
    }

    const { data, error } = await supabase
      .from('subjects')
      .select('*, folders(count), documents(count)')
      .eq('user_id', user.id)
      .order('name', { ascending: true })

    if (!error && data) {
      setSubjects(
        data.map((row: any) => ({
          ...row,
          folderCount: (row.folders as unknown as { count: number }[])?.[0]?.count ?? 0,
          documentCount: (row.documents as unknown as { count: number }[])?.[0]?.count ?? 0,
        }))
      )
    }

    setLoading(false)
  }

  useEffect(() => {
    fetchSubjects()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (colorPickerRef.current && !colorPickerRef.current.contains(event.target as Node)) {
        setColorPickerId(null)
      }
    }
    window.addEventListener('mousedown', handleClickOutside)
    return () => window.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // --- Inline rename ---------------------------------------------------

  function startRename(subject: SubjectCardData) {
    setEditingNameId(subject.id)
    setDraftName(subject.name)
  }

  async function saveRename(subject: SubjectCardData) {
    const trimmed = draftName.trim()
    setEditingNameId(null)
    if (!trimmed || trimmed === subject.name) return

    setSubjects((prev) => prev.map((s) => (s.id === subject.id ? { ...s, name: trimmed } : s)))

    const { error } = await (supabase
      .from('subjects') as any)
      .update({ name: trimmed, updated_at: new Date().toISOString() })
      .eq('id', subject.id)

    if (error) fetchSubjects()
  }

  // --- Color picker -------------------------------------------------------

  async function changeColor(subject: SubjectCardData, color: string) {
    setColorPickerId(null)
    setSubjects((prev) => prev.map((s) => (s.id === subject.id ? { ...s, color } : s)))

    const { error } = await (supabase
      .from('subjects') as any)
      .update({ color, updated_at: new Date().toISOString() })
      .eq('id', subject.id)

    if (error) fetchSubjects()
  }

  // --- Delete -------------------------------------------------------------

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)

    const { error } = await (supabase.from('subjects') as any).delete().eq('id', deleteTarget.id)

    setDeleting(false)
    if (!error) {
      setSubjects((prev) => prev.filter((s) => s.id !== deleteTarget.id))
      setDeleteTarget(null)
    }
  }

  async function handleCreateSubject(data: { name: string; color: string }) {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await (supabase.from('subjects') as any).insert({
      user_id: user.id,
      name: data.name,
      color: data.color,
    })

    if (!error) {
      fetchSubjects()
    } else {
      throw new Error(error.message)
    }
  }

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Subjects</h1>
          <p className="mt-1 text-sm text-slate-500">
            Organize your library by subject — click a card to browse its folders.
          </p>
        </div>
        <Button variant="primary" onClick={() => setModalOpen(true)}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add Subject
        </Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-xl border border-slate-200 bg-white"
            />
          ))}
        </div>
      ) : subjects.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-16 text-center">
          <p className="text-sm font-medium text-slate-700">No subjects yet</p>
          <p className="text-sm text-slate-500">Create one to start organizing your library.</p>
          <Button variant="primary" size="sm" className="mt-2" onClick={() => setModalOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add Subject
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {subjects.map((subject) => (
            <div
              key={subject.id}
              role="button"
              tabIndex={0}
              onClick={() => router.push(`/folders/${subject.id}`)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') router.push(`/folders/${subject.id}`)
              }}
              className="group flex cursor-pointer flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2.5">
                  {/* Color dot + popover */}
                  <div className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() =>
                        setColorPickerId((prev) => (prev === subject.id ? null : subject.id))
                      }
                      aria-label="Change color"
                      className="h-5 w-5 rounded-full ring-2 ring-white transition-transform hover:scale-110"
                      style={{ backgroundColor: subject.color }}
                    />
                    {colorPickerId === subject.id && (
                      <div
                        ref={colorPickerRef}
                        className="absolute left-0 top-7 z-20 w-40 rounded-lg border border-slate-200 bg-white p-2.5 shadow-lg"
                      >
                        <div className="flex flex-wrap gap-1.5">
                          {PRESET_COLORS.map((preset) => (
                            <button
                              key={preset.value}
                              type="button"
                              onClick={() => changeColor(subject, preset.value)}
                              aria-label={`Use color ${preset.name}`}
                              className="flex h-6 w-6 items-center justify-center rounded-full hover:scale-110"
                              style={{ backgroundColor: preset.value }}
                            >
                              {subject.color.toLowerCase() === preset.value.toLowerCase() && (
                                <Check className="h-3.5 w-3.5 text-white" aria-hidden="true" />
                              )}
                            </button>
                          ))}
                        </div>
                        <label className="mt-2 flex items-center gap-2 border-t border-slate-100 pt-2">
                          <span className="text-xs text-slate-500">Custom</span>
                          <input
                            type="color"
                            value={subject.color}
                            onChange={(e) => changeColor(subject, e.target.value)}
                            className="h-6 w-10 cursor-pointer rounded border border-slate-200"
                            aria-label="Pick a custom color"
                          />
                        </label>
                      </div>
                    )}
                  </div>

                  {/* Name (inline editable) */}
                  {editingNameId === subject.id ? (
                    <div
                      className="flex min-w-0 flex-1 items-center gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        autoFocus
                        value={draftName}
                        onChange={(e) => setDraftName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveRename(subject)
                          if (e.key === 'Escape') setEditingNameId(null)
                        }}
                        className="h-8 w-full min-w-0 rounded-md border border-indigo-300 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <button
                        type="button"
                        onClick={() => saveRename(subject)}
                        aria-label="Save name"
                        className="shrink-0 rounded-md p-1 text-green-600 hover:bg-green-50"
                      >
                        <Check className="h-4 w-4" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingNameId(null)}
                        aria-label="Cancel"
                        className="shrink-0 rounded-md p-1 text-slate-400 hover:bg-slate-100"
                      >
                        <X className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        startRename(subject)
                      }}
                      className="truncate text-left text-sm font-semibold text-slate-900 hover:text-indigo-600"
                    >
                      {subject.name}
                    </button>
                  )}
                </div>

                {/* Delete */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setDeleteTarget(subject)
                  }}
                  aria-label="Delete subject"
                  className="shrink-0 rounded-md p-1.5 text-slate-300 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-500 focus:opacity-100 group-hover:opacity-100"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>

              <div className="flex items-center gap-3 text-sm text-slate-500">
                <span className="flex items-center gap-1">
                  <Folder className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                  {subject.folderCount} folder{subject.folderCount === 1 ? '' : 's'}
                </span>
                <span className="flex items-center gap-1">
                  <FileText className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                  {subject.documentCount} doc{subject.documentCount === 1 ? '' : 's'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add subject modal */}
      <SubjectModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleCreateSubject}
      />

      {/* Delete confirmation */}
      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete subject">
        {deleteTarget && (
          <div className="flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-500">
                <AlertTriangle className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm text-slate-700">
                  Are you sure you want to delete{' '}
                  <span className="font-medium text-slate-900">{deleteTarget.name}</span>?
                </p>
                {(deleteTarget.documentCount > 0 || deleteTarget.folderCount > 0) && (
                  <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    This subject has {deleteTarget.folderCount} folder
                    {deleteTarget.folderCount === 1 ? '' : 's'} and {deleteTarget.documentCount}{' '}
                    document{deleteTarget.documentCount === 1 ? '' : 's'} attached.
                  </p>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setDeleteTarget(null)} disabled={deleting}>
                Cancel
              </Button>
              <Button
                variant="primary"
                loading={deleting}
                onClick={confirmDelete}
                className={cn('bg-red-600 hover:bg-red-700 active:bg-red-800 focus-visible:ring-red-500')}
              >
                Delete subject
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}