'use client'

import { useCallback, useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, FileText, Check, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { SubjectBadge } from '@/components/subjects/SubjectBadge'
import { SubjectModal, PRESET_COLORS, type SubjectFormData } from '@/components/subjects/SubjectModal'
import { cn } from '@/lib/utils'
import type { Subject } from '@/types/database'

export default function SubjectsPage() {
  const supabase = createClient()

  const [subjects, setSubjects] = useState<Subject[]>([])
  const [docCounts, setDocCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<Subject | null>(null)
  const [deleting, setDeleting] = useState(false)

  const loadSubjects = useCallback(async () => {
    setLoading(true)
    setErrorMsg(null)

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setSubjects([])
      setLoading(false)
      return
    }

    const { data, error } = await supabase
      .from('subjects')
      .select('*')
      .eq('user_id', user.id)
      .order('name', { ascending: true })

    if (error) {
      setErrorMsg(error.message)
      setLoading(false)
      return
    }

    const fetched = data ?? []
    setSubjects(fetched)
    setLoading(false)

    // Fetch document counts per subject (excludes soft-deleted documents).
    const counts = await Promise.all(
      fetched.map(async (subject) => {
        const { count } = await supabase
          .from('documents')
          .select('id', { count: 'exact', head: true })
          .eq('subject_id', subject.id)
          .eq('user_id', user.id)
          .is('deleted_at', null)
        return [subject.id, count ?? 0] as const
      })
    )
    setDocCounts(Object.fromEntries(counts))
  }, [supabase])

  useEffect(() => {
    loadSubjects()
  }, [loadSubjects])

  async function handleCreate(formData: SubjectFormData) {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) throw new Error('You must be signed in to create a subject.')

    const { data, error } = await supabase
      .from('subjects')
      .insert({ name: formData.name, color: formData.color, user_id: user.id })
      .select()
      .single()

    if (error) throw new Error(error.message)

    setSubjects((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
    setDocCounts((prev) => ({ ...prev, [data.id]: 0 }))
    setIsCreateModalOpen(false)
  }

  function startEdit(subject: Subject) {
    setEditingId(subject.id)
    setEditName(subject.name)
    setEditColor(subject.color)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditName('')
    setEditColor('')
  }

  async function saveEdit(id: string) {
    const trimmed = editName.trim()
    if (!trimmed) return

    setSavingEdit(true)
    const { data, error } = await supabase
      .from('subjects')
      .update({ name: trimmed, color: editColor })
      .eq('id', id)
      .select()
      .single()
    setSavingEdit(false)

    if (error) {
      setErrorMsg(error.message)
      return
    }

    setSubjects((prev) =>
      prev.map((s) => (s.id === id ? data : s)).sort((a, b) => a.name.localeCompare(b.name))
    )
    cancelEdit()
  }

  async function handleDelete() {
    if (!deleteTarget) return

    setDeleting(true)
    const { error } = await supabase.from('subjects').delete().eq('id', deleteTarget.id)
    setDeleting(false)

    if (error) {
      setErrorMsg(error.message)
      return
    }

    setSubjects((prev) => prev.filter((s) => s.id !== deleteTarget.id))
    setDocCounts((prev) => {
      const next = { ...prev }
      delete next[deleteTarget.id]
      return next
    })
    setDeleteTarget(null)
  }

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Subjects</h1>
          <p className="mt-1 text-sm text-slate-500">Organize your documents into subjects.</p>
        </div>
        <Button variant="primary" onClick={() => setIsCreateModalOpen(true)}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add Subject
        </Button>
      </div>

      {errorMsg && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMsg}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="flex animate-pulse flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4"
            >
              <div className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-full bg-slate-100" />
                <div className="h-3.5 w-2/3 rounded bg-slate-100" />
              </div>
              <div className="h-2.5 w-1/3 rounded bg-slate-100" />
            </div>
          ))}
        </div>
      ) : subjects.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-200 bg-white px-5 py-16 text-center">
          <p className="text-sm font-medium text-slate-700">No subjects yet</p>
          <p className="text-sm text-slate-500">Create a subject to start organizing your library.</p>
          <Button variant="primary" size="sm" className="mt-2" onClick={() => setIsCreateModalOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Create your first subject
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {subjects.map((subject) => {
            const isEditing = editingId === subject.id

            return (
              <Card key={subject.id} className="group relative p-4">
                {isEditing ? (
                  <div className="flex flex-col gap-3" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="text"
                      value={editName}
                      autoFocus
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveEdit(subject.id)
                        if (e.key === 'Escape') cancelEdit()
                      }}
                      className="h-9 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1"
                    />
                    <div className="flex flex-wrap gap-1.5">
                      {PRESET_COLORS.map((preset) => (
                        <button
                          key={preset.value}
                          type="button"
                          onClick={() => setEditColor(preset.value)}
                          aria-label={preset.name}
                          className={cn(
                            'h-6 w-6 rounded-full transition-transform hover:scale-110',
                            editColor === preset.value && 'ring-2 ring-offset-2'
                          )}
                          style={{
                            backgroundColor: preset.value,
                            ...(editColor === preset.value
                              ? { ['--tw-ring-color' as string]: preset.value }
                              : {}),
                          }}
                        />
                      ))}
                    </div>
                    <div className="flex justify-end gap-2 pt-1">
                      <Button variant="ghost" size="sm" onClick={cancelEdit}>
                        <X className="h-4 w-4" aria-hidden="true" />
                      </Button>
                      <Button variant="primary" size="sm" onClick={() => saveEdit(subject.id)} loading={savingEdit}>
                        <Check className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => startEdit(subject)}
                    className="flex w-full flex-col items-start gap-3 rounded-lg text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                  >
                    <div className="flex w-full items-start justify-between gap-2">
                      <SubjectBadge name={subject.name} color={subject.color} size="lg" />
                      <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => {
                            e.stopPropagation()
                            startEdit(subject)
                          }}
                          className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                          aria-label={`Edit ${subject.name}`}
                        >
                          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                        </span>
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => {
                            e.stopPropagation()
                            setDeleteTarget(subject)
                          }}
                          className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                          aria-label={`Delete ${subject.name}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>
                        {docCounts[subject.id] ?? 0} {docCounts[subject.id] === 1 ? 'document' : 'documents'}
                      </span>
                    </div>
                  </button>
                )}
              </Card>
            )
          })}
        </div>
      )}

      <SubjectModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} onSave={handleCreate} />

      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete subject?">
        <div className="flex flex-col gap-4">
          <p className="text-sm text-slate-600">
            Are you sure you want to delete{' '}
            <span className="font-medium text-slate-900">{deleteTarget?.name}</span>? This can&apos;t be undone.
            Documents in this subject will be kept but unassigned.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button
              onClick={handleDelete}
              loading={deleting}
              className="bg-red-600 text-white hover:bg-red-700 active:bg-red-800 focus-visible:ring-red-500"
            >
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}